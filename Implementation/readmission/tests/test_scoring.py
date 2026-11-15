from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)

PATIENT = {
    "age_band": "[70-80)", "gender": "Female", "admission_type": "Emergency", "time_in_hospital": 7,
    "disposition_group": "Home", "number_inpatient": 3, "number_emergency": 2, "number_outpatient": 4,
    "diag_1_group": "Circulatory", "diag_2_group": "Diabetes", "number_diagnoses": 9,
    "num_lab_procedures": 48, "num_procedures": 2, "num_medications": 18, "A1Cresult": "None", "change": "No",
}

def test_predict_returns_result_shape():
    r = client.post("/predict", json=PATIENT)
    assert r.status_code == 200
    body = r.json()
    assert 0 < body["probability"] < 1
    assert body["tier"] in {"low", "medium", "high"}
    assert len(body["contributions"]) <= 5
    assert body["placeholder"] is False

def test_more_prior_admissions_means_higher_risk():
    low = client.post("/predict", json={**PATIENT, "number_inpatient": 0}).json()
    high = client.post("/predict", json={**PATIENT, "number_inpatient": 5}).json()
    assert high["probability"] > low["probability"]

def test_predict_rejects_unknown_category():
    r = client.post("/predict", json={**PATIENT, "gender": "Unknown"})
    assert r.status_code == 422
