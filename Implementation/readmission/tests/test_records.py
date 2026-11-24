import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text

from api.db import ENGINE
from api.main import app

FEATURES = {
    "age_band": "[70-80)", "gender": "Female", "admission_type": "Emergency", "time_in_hospital": 7,
    "disposition_group": "Home", "number_inpatient": 3, "number_emergency": 2, "number_outpatient": 4,
    "diag_1_group": "Circulatory", "diag_2_group": "Diabetes", "number_diagnoses": 9,
    "num_lab_procedures": 48, "num_procedures": 2, "num_medications": 18, "A1Cresult": "None", "change": "No",
}


def test_add_record_needs_login():
    r = TestClient(app).post("/records", json={"features": FEATURES})
    assert r.status_code == 401


def test_add_record_is_stored_with_open_outcome():
    with TestClient(app) as c:
        email = f"test-{uuid.uuid4().hex[:8]}@example.com"
        c.post("/auth/register", json={"fullName": "Records Test", "email": email, "password": "Test@1234567"})
        token = c.post("/auth/login", json={"email": email, "password": "Test@1234567"}).json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        try:
            r = c.post("/records", headers=h, json={
                "identity": {"patient_name": "Test, Patient", "mrn": "  ", "encounter_ref": "ENC-1"},
                "features": FEATURES})
            assert r.status_code == 201
            saved = r.json()
            # stored probability matches what /predict gives for the same fields
            assert saved["probability"] == c.post("/predict", json=FEATURES).json()["probability"]

            with ENGINE.connect() as conn:
                row = conn.execute(text("SELECT * FROM scored_records WHERE id = :i"), {"i": saved["id"]}).one()
            assert row.patient_name == "Test, Patient"
            assert row.mrn is None                      # blank identity fields stored as NULL
            assert row.outcome is None                  # label written back later
            assert row.features["number_inpatient"] == 3

            assert c.post("/records", headers=h, json={"features": {**FEATURES, "gender": "?"}}).status_code == 422

            # listed on the Patients page, newest first
            listed = c.get("/records", headers=h).json()
            assert listed[0]["id"] == saved["id"]
            assert listed[0]["age_band"] == "[70-80)" and listed[0]["saved_by"] == "Records Test"

            # detail view has the explanation and the saved identity
            detail = c.get(f"/records/{saved['id']}", headers=h).json()
            assert detail["encounter_id"] == "ENC-1"
            assert detail["probability"] == saved["probability"]
            assert 0 < len(detail["contributions"]) <= 8
            assert c.get("/records/999999999", headers=h).status_code == 404

            # outcome can be set, changed back to unknown, and only to 0 / 1
            assert c.put(f"/records/{saved['id']}/outcome", headers=h, json={"outcome": 1}).status_code == 200
            assert c.get(f"/records/{saved['id']}", headers=h).json()["outcome"] == 1
            assert c.put(f"/records/{saved['id']}/outcome", headers=h, json={"outcome": None}).status_code == 200
            assert c.put(f"/records/{saved['id']}/outcome", headers=h, json={"outcome": 2}).status_code == 422
        finally:   # don't leave test rows in the real dataset
            with ENGINE.begin() as conn:
                conn.execute(text("""DELETE FROM scored_records WHERE user_id =
                                     (SELECT id FROM users WHERE email = :e)"""), {"e": email})
                conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})
