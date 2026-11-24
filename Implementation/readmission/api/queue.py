### Discharge queue: the fixed demo cohort (api/demo_cohort.csv, written by ml/make_demo_cohort.py)
### plus any saved records staff added to the queue (scored_records.in_queue), all scored with the
### same model, tiers and actions as /predict and ranked from highest to lowest risk. Each patient
### has a detail view with the SHAP explanation, and staff accept or override the recommended action.

from pathlib import Path
from typing import Literal, Optional

import pandas as pd
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import text

from api.auth import current_user
from api.db import ENGINE
from api.scoring import (ACTIONS, FEATURES, HIGH_THRESHOLD, MEDIUM_THRESHOLD, PIPELINE, PatientIn,
                         explain_patient, tier_of)

router = APIRouter(prefix="/queue")

COHORT_PATH = Path(__file__).resolve().parent / "demo_cohort.csv"
COHORT = pd.read_csv(COHORT_PATH, dtype={"A1Cresult": str}, keep_default_na=False)
FORM_FIELDS = list(PatientIn.model_fields)


def score_cohort(df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    X["age_num"] = X["age_band"].str.extract(r"\[(\d+)-")[0].astype(int) + 5   # same as build_features
    X["total_prior_visits"] = X["number_outpatient"] + X["number_emergency"] + X["number_inpatient"]
    out = df.copy()
    out["probability"] = PIPELINE.predict_proba(X[FEATURES])[:, 1]
    out["tier"] = out["probability"].map(tier_of)
    out["action"] = out["tier"].map(ACTIONS)
    return out


# ---- decisions --------------------------------------------------------------------------------

def latest_decisions(key: Literal["encounter_id", "record_id"], ids: Optional[list[int]] = None) -> dict[int, dict]:
    """Most recent decision per demo encounter or per saved record (optionally only the given ids)."""
    where = f"WHERE d.{key} IS NOT NULL" + (f" AND d.{key} = ANY(:ids)" if ids is not None else "")
    sql = f"""SELECT DISTINCT ON (d.{key}) d.{key} AS k, d.decision, d.action, d.reason,
                     d.created_at, u.full_name
              FROM queue_decisions d LEFT JOIN users u ON u.id = d.user_id
              {where}
              ORDER BY d.{key}, d.created_at DESC, d.id DESC"""
    with ENGINE.connect() as conn:
        rows = conn.execute(text(sql), {"ids": ids} if ids is not None else {}).all()
    return {r.k: {"decision": r.decision, "action": r.action, "reason": r.reason,
                  "by": r.full_name, "at": r.created_at.isoformat()} for r in rows}


class DecisionIn(BaseModel):
    decision: Literal["accepted", "overridden"]
    action: str = Field(min_length=1, max_length=200)
    reason: Optional[str] = Field(default=None, max_length=1000)

    @model_validator(mode="after")
    def override_needs_reason(self):
        if self.decision == "overridden" and not (self.reason or "").strip():
            raise ValueError("Give a reason for overriding the recommended action")
        return self


def save_decision(key: Literal["encounter_id", "record_id"], id_: int, body: DecisionIn, user) -> dict:
    with ENGINE.begin() as conn:
        conn.execute(text(f"""INSERT INTO queue_decisions ({key}, user_id, decision, action, reason)
                              VALUES (:k, :u, :d, :a, :r)"""),
                     {"k": id_, "u": user.id, "d": body.decision, "a": body.action,
                      "r": (body.reason or "").strip() or None})
    return latest_decisions(key, [id_])[id_]


# ---- queue ------------------------------------------------------------------------------------

def queued_records() -> pd.DataFrame:
    """Saved records currently on the queue, one row per record with the form fields."""
    with ENGINE.connect() as conn:
        rows = conn.execute(text("""SELECT id, patient_name, encounter_ref, features FROM scored_records
                                    WHERE in_queue ORDER BY queued_at, id""")).all()
    return pd.DataFrame([{"record_id": r.id, "patient_name": r.patient_name,
                          "encounter_ref": r.encounter_ref, **r.features} for r in rows])


def find_encounter(encounter_id: str) -> pd.Series:
    raw = encounter_id.upper().removeprefix("ENC-")
    match = COHORT[COHORT["encounter_id"].astype(str) == raw] if raw.isdigit() else COHORT.iloc[0:0]
    if match.empty:
        raise HTTPException(404, f"Encounter {encounter_id} is not in today's queue")
    return match.iloc[0]


def queue_row(r, decision) -> dict:
    return {
        "age_band": r.age_band,
        "diag_1_group": r.diag_1_group,
        "time_in_hospital": int(r.time_in_hospital),
        "number_inpatient": int(r.number_inpatient),
        "num_medications": int(r.num_medications),
        "disposition_group": r.disposition_group,
        "probability": round(float(r.probability), 2),
        "tier": r.tier,
        "action": r.action,
        "decision": decision,
    }


@router.get("")
def queue():
    demo = score_cohort(COHORT)
    demo_decisions = latest_decisions("encounter_id")
    rows = [{"encounter_id": f"ENC-{r.encounter_id}", "source": "demo", "record_id": None,
             "patient_name": None, **queue_row(r, demo_decisions.get(int(r.encounter_id)))}
            for r in demo.itertuples()]

    saved = queued_records()
    if not saved.empty:
        saved = score_cohort(saved)
        rec_decisions = latest_decisions("record_id", [int(i) for i in saved["record_id"]])
        rows += [{"encounter_id": r.encounter_ref or f"REC-{r.record_id}", "source": "saved",
                  "record_id": int(r.record_id), "patient_name": r.patient_name,
                  **queue_row(r, rec_decisions.get(int(r.record_id)))}
                 for r in saved.itertuples()]

    rows.sort(key=lambda r: r["probability"], reverse=True)
    probs = [r["probability"] for r in rows]
    return {
        "patients": rows,
        "counts": {t: sum(r["tier"] == t for r in rows) for t in ACTIONS},
        "expected_readmissions": round(sum(probs), 1),
        "high_threshold": round(HIGH_THRESHOLD, 2),
        "medium_threshold": round(MEDIUM_THRESHOLD, 2),
        "actions": ACTIONS,
    }


@router.get("/{encounter_id}")
def patient(encounter_id: str):
    row = find_encounter(encounter_id)
    p = PatientIn(**{f: getattr(row[f], "item", lambda: row[f])() for f in FORM_FIELDS})  # numpy -> python
    enc = int(row["encounter_id"])
    return {
        "encounter_id": f"ENC-{enc}",
        # identity is never sent to the model; the UCI demo cohort is de-identified so this is None
        "patient_name": (str(row["patient_name"]).strip() or None) if "patient_name" in row.index else None,
        **explain_patient(p),
        "decision": latest_decisions("encounter_id", [enc]).get(enc),
    }


@router.post("/{encounter_id}/decision", status_code=201)
def decide(encounter_id: str, body: DecisionIn, user=Depends(current_user)):
    enc = int(find_encounter(encounter_id)["encounter_id"])
    return save_decision("encounter_id", enc, body, user)
