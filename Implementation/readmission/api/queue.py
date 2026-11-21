### Discharge queue: scores a fixed demo cohort (api/demo_cohort.csv, written by
### ml/make_demo_cohort.py) with the same model, tiers and actions as /predict,
### and returns it ranked from highest to lowest risk.

from pathlib import Path

import pandas as pd
from fastapi import APIRouter

from api.scoring import ACTIONS, FEATURES, HIGH_THRESHOLD, MEDIUM_THRESHOLD, PIPELINE

router = APIRouter()

COHORT_PATH = Path(__file__).resolve().parent / "demo_cohort.csv"
COHORT = pd.read_csv(COHORT_PATH, dtype={"A1Cresult": str}, keep_default_na=False)


def tier_of(p: float) -> str:
    return "high" if p >= HIGH_THRESHOLD else "medium" if p >= MEDIUM_THRESHOLD else "low"


def score_cohort(df: pd.DataFrame) -> pd.DataFrame:
    X = df.copy()
    X["age_num"] = X["age_band"].str.extract(r"\[(\d+)-")[0].astype(int) + 5   # same as build_features
    X["total_prior_visits"] = X["number_outpatient"] + X["number_emergency"] + X["number_inpatient"]
    out = df.copy()
    out["probability"] = PIPELINE.predict_proba(X[FEATURES])[:, 1]
    out["tier"] = out["probability"].map(tier_of)
    out["action"] = out["tier"].map(ACTIONS)
    return out.sort_values("probability", ascending=False)


@router.get("/queue")
def queue():
    scored = score_cohort(COHORT)
    rows = [{
        "encounter_id": f"ENC-{r.encounter_id}",
        "age_band": r.age_band,
        "diag_1_group": r.diag_1_group,
        "time_in_hospital": int(r.time_in_hospital),
        "number_inpatient": int(r.number_inpatient),
        "num_medications": int(r.num_medications),
        "disposition_group": r.disposition_group,
        "probability": round(float(r.probability), 2),
        "tier": r.tier,
        "action": r.action,
    } for r in scored.itertuples()]
    return {
        "patients": rows,
        "counts": {t: int((scored["tier"] == t).sum()) for t in ACTIONS},
        "expected_readmissions": round(float(scored["probability"].sum()), 1),
        "high_threshold": round(HIGH_THRESHOLD, 2),
        "medium_threshold": round(MEDIUM_THRESHOLD, 2),
        "actions": ACTIONS,
    }
