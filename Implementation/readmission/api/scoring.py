### Single-patient scoring. Request schema is the real one, the scoring itself is a
### hand-weighted placeholder until the trained pipeline is saved and loaded in here

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

AgeBand = Literal["[0-10)", "[10-20)", "[20-30)", "[30-40)", "[40-50)",
                  "[50-60)", "[60-70)", "[70-80)", "[80-90)", "[90-100)"]
DiagGroup = Literal["Circulatory", "Respiratory", "Digestive", "Diabetes", "Injury", "Musculoskeletal",
                    "Genitourinary", "Neoplasms", "Other", "Missing"]

BASE_RATE = 0.11
HIGH_THRESHOLD = 0.47
MEDIUM_THRESHOLD = 0.25

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
DISPOSITION_WEIGHT = {"Home": 0.10, "Home with services": 0.05, "Care facility": 0.08,
                      "Other hospital": 0.06, "Left AMA": 0.12, "Other": 0.0}


def placeholder_contributions(p: PatientIn) -> list[tuple[str, float]]:
    return [
        (f"Prior inpatient admissions ({p.number_inpatient})", min(p.number_inpatient, 4) * 0.073),
        (f"Discharge medications ({p.num_medications})", (p.num_medications - 10) * 0.019),
        (DISPOSITION_LABEL.get(p.disposition_group, p.disposition_group), DISPOSITION_WEIGHT[p.disposition_group]),
        (f"{p.admission_type} admission", 0.06 if p.admission_type == "Emergency" else -0.02),
        (f"Procedures performed ({p.num_procedures})", -0.02 * p.num_procedures),
        (f"Emergency visits ({p.number_emergency})", min(p.number_emergency, 4) * 0.02),
        (f"Length of stay ({p.time_in_hospital} days)", (p.time_in_hospital - 4) * 0.01),
    ]


@router.post("/predict")
def predict(patient: PatientIn):
    contribs = placeholder_contributions(patient)
    probability = round(min(max(BASE_RATE + sum(v for _, v in contribs), 0.01), 0.99), 2)
    tier = "high" if probability >= HIGH_THRESHOLD else "medium" if probability >= MEDIUM_THRESHOLD else "low"
    top = sorted(contribs, key=lambda c: abs(c[1]), reverse=True)[:5]
    return {
        "probability": probability,
        "tier": tier,
        "threshold": HIGH_THRESHOLD,
        "base_rate": BASE_RATE,
        "contributions": [{"feature": f, "value": round(v, 2)} for f, v in top if round(v, 2) != 0],
        "action": ACTIONS[tier],
        "placeholder": True,
    }
