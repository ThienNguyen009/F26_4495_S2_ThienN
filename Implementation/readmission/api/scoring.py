### Single-patient scoring with the trained XGBoost pipeline (models/readmission_form.joblib,
### written by ml/train.py). The explanation is the model's own SHAP values, not a second model

from pathlib import Path
from typing import Literal

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

AgeBand = Literal["[0-10)", "[10-20)", "[20-30)", "[30-40)", "[40-50)",
                  "[50-60)", "[60-70)", "[70-80)", "[80-90)", "[90-100)"]
DiagGroup = Literal["Circulatory", "Respiratory", "Digestive", "Diabetes", "Injury", "Musculoskeletal",
                    "Genitourinary", "Neoplasms", "Other", "Missing"]

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "readmission_form.joblib"
BUNDLE = joblib.load(MODEL_PATH)
PIPELINE = BUNDLE["pipeline"]
FEATURES = list(PIPELINE.feature_names_in_)

### tiers by follow-up capacity: top 10% of validation patients are high, next 10% medium
HIGH_THRESHOLD = BUNDLE["high_threshold"]
MEDIUM_THRESHOLD = BUNDLE["medium_threshold"]

ACTIONS = {
    "high": "Home-care referral & medication reconciliation",
    "medium": "Follow-up phone call within 7 days",
    "low": "Standard discharge instructions",
}


#  the clinical fields only identity fields never reach the model
class PatientIn(BaseModel):
    age_band: AgeBand
    gender: Literal["Female", "Male"]
    admission_type: Literal["Emergency", "Urgent", "Elective", "Trauma", "Other", "Unknown"]
    time_in_hospital: int = Field(ge=1, le=14)
    disposition_group: Literal["Home", "Home with services", "Care facility", "Other hospital", "Left AMA", "Other"]
    number_inpatient: int = Field(ge=0)
    number_emergency: int = Field(ge=0)
    number_outpatient: int = Field(ge=0)
    diag_1_group: DiagGroup
    diag_2_group: DiagGroup
    number_diagnoses: int = Field(ge=1, le=16)
    num_lab_procedures: int = Field(ge=0)
    num_procedures: int = Field(ge=0, le=6)
    num_medications: int = Field(ge=0)
    A1Cresult: Literal["None", "Norm", ">7", ">8"]
    change: Literal["No", "Ch"]


DISPOSITION_LABEL = {"Home": "Home, no services"}


def to_features(p: PatientIn) -> pd.DataFrame:
    row = p.model_dump()
    row["age_num"] = int(p.age_band[1:].split("-")[0]) + 5     # same as build_features
    row["total_prior_visits"] = p.number_outpatient + p.number_emergency + p.number_inpatient
    return pd.DataFrame([row])[FEATURES]


def label(feature: str, p: PatientIn) -> str:
    return {
        "age_num": f"Age {p.age_band}",
        "gender": p.gender,
        "admission_type": f"{p.admission_type} admission",
        "time_in_hospital": f"Length of stay ({p.time_in_hospital} days)",
        "disposition_group": f"Discharge: {DISPOSITION_LABEL.get(p.disposition_group, p.disposition_group)}",
        "number_inpatient": f"Prior inpatient admissions ({p.number_inpatient})",
        "number_emergency": f"Emergency visits ({p.number_emergency})",
        "number_outpatient": f"Outpatient visits ({p.number_outpatient})",
        "total_prior_visits": f"Total prior visits ({p.number_outpatient + p.number_emergency + p.number_inpatient})",
        "diag_1_group": f"Primary diagnosis: {p.diag_1_group}",
        "diag_2_group": f"Secondary diagnosis: {p.diag_2_group}",
        "number_diagnoses": f"Diagnoses recorded ({p.number_diagnoses})",
        "num_lab_procedures": f"Lab procedures ({p.num_lab_procedures})",
        "num_procedures": f"Procedures performed ({p.num_procedures})",
        "num_medications": f"Medications ({p.num_medications})",
        "A1Cresult": f"A1C result: {p.A1Cresult}",
        "change": "Diabetes medication changed" if p.change == "Ch" else "No diabetes medication change",
    }[feature]


def source_fields() -> list[str]:
    """The form field behind each column the preprocessor outputs (one-hot columns -> one field)."""
    fields = []
    for name in PIPELINE["prep"].get_feature_names_out():
        kind, rest = name.split("__", 1)
        fields.append(rest if kind == "num" else max((f for f in FEATURES if rest.startswith(f + "_")), key=len))
    return fields


SOURCE = source_fields()


def explain(X: pd.DataFrame) -> tuple[float, float, pd.Series]:
    """SHAP values per form field, rescaled from log-odds to probability points so they
    add up from the model's baseline to this patient's score."""
    contribs = PIPELINE["model"].get_booster().predict(
        xgb.DMatrix(PIPELINE["prep"].transform(X)), pred_contribs=True)[0]
    bias = contribs[-1]
    per_field = pd.Series(contribs[:-1], index=SOURCE).groupby(level=0).sum()
    total = per_field.sum()
    baseline = 1 / (1 + np.exp(-bias))
    probability = 1 / (1 + np.exp(-(bias + total)))
    scale = (probability - baseline) / total if abs(total) > 1e-9 else baseline * (1 - baseline)
    return float(probability), float(baseline), per_field * scale


def tier_of(probability: float) -> str:
    return "high" if probability >= HIGH_THRESHOLD else "medium" if probability >= MEDIUM_THRESHOLD else "low"


def explain_patient(p: PatientIn, top_n: int = 8) -> dict:
    """Score, tier, recommended action and top SHAP factors for the patient detail views
    (queue patients and saved records share this)."""
    probability, baseline, contribs = explain(to_features(p))
    tier = tier_of(probability)
    top = contribs[contribs.abs().sort_values(ascending=False).index][:top_n]
    record = p.model_dump()
    record["disposition_group"] = DISPOSITION_LABEL.get(p.disposition_group, p.disposition_group)
    return {
        "record": record,
        "probability": round(probability, 2),
        "tier": tier,
        "high_threshold": round(HIGH_THRESHOLD, 2),
        "medium_threshold": round(MEDIUM_THRESHOLD, 2),
        "base_rate": round(baseline, 2),
        "contributions": [{"feature": label(f, p), "value": round(float(v), 3)}
                          for f, v in top.items() if round(float(v), 3) != 0],
        "action": ACTIONS[tier],
        "actions": ACTIONS,
    }


@router.post("/predict")
def predict(patient: PatientIn):
    probability, baseline, contribs = explain(to_features(patient))
    tier = "high" if probability >= HIGH_THRESHOLD else "medium" if probability >= MEDIUM_THRESHOLD else "low"
    top = contribs[contribs.abs().sort_values(ascending=False).index][:5]
    return {
        "probability": round(probability, 2),
        "tier": tier,
        "threshold": round(HIGH_THRESHOLD, 2),
        "base_rate": round(baseline, 2),
        "contributions": [{"feature": label(f, patient), "value": round(float(v), 2)}
                          for f, v in top.items() if round(float(v), 2) != 0],
        "action": ACTIONS[tier],
        "placeholder": False,
    }
