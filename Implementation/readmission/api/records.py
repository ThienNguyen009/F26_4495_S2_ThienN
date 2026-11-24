### "Add to dataset" from Score one patient: stores the record and its prediction with the
### 30-day outcome left open (scored_records in sql/users.sql). The server re-scores the
### clinical fields itself, so the stored probability always matches the stored features.
### Saved records are listed on the Patients page; staff can put one on the Discharge queue,
### record the 30-day outcome once known, or delete it.

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from api.auth import current_user
from api.db import ENGINE
from api.queue import DecisionIn, latest_decisions, save_decision
from api.scoring import PatientIn, explain, explain_patient, tier_of, to_features

router = APIRouter(prefix="/records")


class Identity(BaseModel):
    patient_name: Optional[str] = Field(default=None, max_length=200)
    mrn: Optional[str] = Field(default=None, max_length=100)
    encounter_ref: Optional[str] = Field(default=None, max_length=100)
    unit_bed: Optional[str] = Field(default=None, max_length=100)
    race: Optional[str] = Field(default=None, max_length=50)
    scored_by: Optional[str] = Field(default=None, max_length=200)


class RecordIn(BaseModel):
    identity: Identity = Identity()
    features: PatientIn
    add_to_queue: bool = False


class QueueIn(BaseModel):
    in_queue: bool


class OutcomeIn(BaseModel):
    outcome: Optional[Literal[0, 1]]   # 1 = readmitted within 30 days, None = not known yet


def blank_to_none(v: Optional[str]) -> Optional[str]:
    return (v or "").strip() or None


SELECT_RECORD = """SELECT r.*, u.full_name AS saved_by
                   FROM scored_records r LEFT JOIN users u ON u.id = r.user_id"""


def summary(r) -> dict:
    return {
        "id": r.id,
        "created_at": r.created_at.isoformat(),
        "patient_name": r.patient_name,
        "mrn": r.mrn,
        "encounter_ref": r.encounter_ref,
        "unit_bed": r.unit_bed,
        "scored_by": r.scored_by,
        "saved_by": r.saved_by,
        "age_band": r.features["age_band"],
        "diag_1_group": r.features["diag_1_group"],
        "probability": round(float(r.probability), 2),
        "tier": r.tier,
        "outcome": r.outcome,
        "in_queue": r.in_queue,
    }


@router.post("", status_code=201)
def add_record(body: RecordIn, user=Depends(current_user)):
    probability, _, _ = explain(to_features(body.features))
    tier = tier_of(probability)
    ident = {k: blank_to_none(v) for k, v in body.identity.model_dump().items()}
    with ENGINE.begin() as conn:
        row = conn.execute(
            text("""INSERT INTO scored_records (user_id, patient_name, mrn, encounter_ref, unit_bed, race,
                                                scored_by, features, probability, tier, in_queue, queued_at)
                    VALUES (:user_id, :patient_name, :mrn, :encounter_ref, :unit_bed, :race,
                            :scored_by, CAST(:features AS JSONB), :probability, :tier,
                            :q, CASE WHEN :q THEN now() END)
                    RETURNING id, created_at"""),
            {"user_id": user.id, **ident, "features": json.dumps(body.features.model_dump()),
             "probability": probability, "tier": tier, "q": body.add_to_queue},
        ).one()
    return {"id": row.id, "created_at": row.created_at.isoformat(),
            "probability": round(probability, 2), "tier": tier, "in_queue": body.add_to_queue}


@router.get("")
def list_records(limit: int = 500, user=Depends(current_user)):
    """Saved records, newest first."""
    with ENGINE.connect() as conn:
        rows = conn.execute(text(SELECT_RECORD + " ORDER BY r.created_at DESC, r.id DESC LIMIT :n"),
                            {"n": max(1, min(limit, 2000))}).all()
    return [summary(r) for r in rows]


def get_row(record_id: int):
    with ENGINE.connect() as conn:
        row = conn.execute(text(SELECT_RECORD + " WHERE r.id = :i"), {"i": record_id}).first()
    if row is None:
        raise HTTPException(404, f"Record {record_id} not found")
    return row


@router.get("/{record_id}")
def get_record(record_id: int, user=Depends(current_user)):
    """Detail view: same shape as GET /queue/{id}, plus the saved identity and outcome.
    The explanation is recomputed with the current model; `saved_probability` is what was stored."""
    r = get_row(record_id)
    return {
        **summary(r),
        "record_id": r.id,
        "encounter_id": r.encounter_ref or f"REC-{r.id}",
        **explain_patient(PatientIn(**r.features)),
        "saved_probability": round(float(r.probability), 2),
        "saved_tier": r.tier,
        "decision": latest_decisions("record_id", [r.id]).get(r.id),
    }


@router.put("/{record_id}/outcome")
def set_outcome(record_id: int, body: OutcomeIn, user=Depends(current_user)):
    get_row(record_id)
    with ENGINE.begin() as conn:
        conn.execute(text("UPDATE scored_records SET outcome = :o WHERE id = :i"),
                     {"o": body.outcome, "i": record_id})
    return {"id": record_id, "outcome": body.outcome}


@router.put("/{record_id}/queue")
def set_queue(record_id: int, body: QueueIn, user=Depends(current_user)):
    """Add the record to the Discharge queue or take it off (its decisions are kept)."""
    get_row(record_id)
    with ENGINE.begin() as conn:
        conn.execute(text("""UPDATE scored_records
                             SET in_queue = :q, queued_at = CASE WHEN :q THEN COALESCE(queued_at, now()) END
                             WHERE id = :i"""), {"q": body.in_queue, "i": record_id})
    return {"id": record_id, "in_queue": body.in_queue}


@router.post("/{record_id}/decision", status_code=201)
def decide(record_id: int, body: DecisionIn, user=Depends(current_user)):
    if not get_row(record_id).in_queue:
        raise HTTPException(409, "Add this patient to the discharge queue before assigning follow-up")
    return save_decision("record_id", record_id, body, user)


@router.delete("/{record_id}", status_code=204)
def delete_record(record_id: int, user=Depends(current_user)):
    """Permanently delete a saved record; its queue decisions go with it (ON DELETE CASCADE)."""
    get_row(record_id)
    with ENGINE.begin() as conn:
        conn.execute(text("DELETE FROM scored_records WHERE id = :i"), {"i": record_id})
