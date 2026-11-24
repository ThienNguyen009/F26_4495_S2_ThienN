import uuid

from fastapi.testclient import TestClient
from sqlalchemy import text

from api.db import ENGINE
from api.main import app

client = TestClient(app)


def first_encounter():
    return client.get("/queue").json()["patients"][0]


def test_patient_detail_matches_queue():
    q = first_encounter()
    body = client.get(f"/queue/{q['encounter_id']}").json()
    assert body["probability"] == q["probability"]
    assert body["tier"] == q["tier"]
    assert 0 < len(body["contributions"]) <= 8
    assert body["record"]["age_band"] == q["age_band"]


def test_unknown_encounter_is_404():
    assert client.get("/queue/ENC-1").status_code == 404
    assert client.get("/queue/not-an-id").status_code == 404


def test_decision_needs_login():
    q = first_encounter()
    r = client.post(f"/queue/{q['encounter_id']}/decision", json={"decision": "accepted", "action": q["action"]})
    assert r.status_code == 401


def test_override_requires_reason_and_is_saved():
    with TestClient(app) as c:
        email = f"test-{uuid.uuid4().hex[:8]}@example.com"
        c.post("/auth/register", json={"fullName": "Decision Test", "organization": "", "email": email,
                                       "password": "Test@1234567"})
        token = c.post("/auth/login", json={"email": email, "password": "Test@1234567"}).json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        enc = c.get("/queue").json()["patients"][0]["encounter_id"]
        try:
            check_override(c, h, enc)
        finally:   # leave the real queue as it was
            with ENGINE.begin() as conn:
                conn.execute(text("""DELETE FROM queue_decisions WHERE user_id =
                                     (SELECT id FROM users WHERE email = :e)"""), {"e": email})
                conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})


def check_override(c, h, enc):
    no_reason = c.post(f"/queue/{enc}/decision", headers=h,
                       json={"decision": "overridden", "action": "Standard discharge instructions"})
    assert no_reason.status_code == 422

    r = c.post(f"/queue/{enc}/decision", headers=h,
               json={"decision": "overridden", "action": "Standard discharge instructions",
                     "reason": "Already enrolled in a community programme"})
    assert r.status_code == 201
    detail = c.get(f"/queue/{enc}").json()
    assert detail["decision"]["decision"] == "overridden"
    assert detail["decision"]["by"] == "Decision Test"
