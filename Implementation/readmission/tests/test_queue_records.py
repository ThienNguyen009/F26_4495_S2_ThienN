### Saved records on the Discharge queue, decisions on them, and deleting a record.
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from api.db import ENGINE
from api.main import app
from tests.test_records import FEATURES


@pytest.fixture
def signed_in():
    with TestClient(app) as c:
        email = f"test-{uuid.uuid4().hex[:8]}@example.com"
        c.post("/auth/register", json={"fullName": "Queue Test", "email": email, "password": "Test@1234567"})
        token = c.post("/auth/login", json={"email": email, "password": "Test@1234567"}).json()["access_token"]
        yield c, {"Authorization": f"Bearer {token}"}
        with ENGINE.begin() as conn:   # don't leave test rows in the real tables
            conn.execute(text("""DELETE FROM scored_records WHERE user_id =
                                 (SELECT id FROM users WHERE email = :e)"""), {"e": email})
            conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})


def in_queue(c, record_id):
    return [p for p in c.get("/queue").json()["patients"] if p["record_id"] == record_id]


def test_add_to_queue_on_save_and_toggle(signed_in):
    c, h = signed_in
    base = len(c.get("/queue").json()["patients"])
    rec = c.post("/records", headers=h, json={"identity": {"patient_name": "Queue, Patient"},
                                             "features": FEATURES, "add_to_queue": True}).json()
    assert rec["in_queue"] is True

    q = c.get("/queue").json()
    assert len(q["patients"]) == base + 1
    [row] = in_queue(c, rec["id"])
    assert row["source"] == "saved" and row["patient_name"] == "Queue, Patient"
    assert row["encounter_id"] == f"REC-{rec['id']}"
    assert row["probability"] == rec["probability"]
    assert sum(q["counts"].values()) == len(q["patients"])
    probs = [p["probability"] for p in q["patients"]]
    assert probs == sorted(probs, reverse=True)

    assert c.put(f"/records/{rec['id']}/queue", headers=h, json={"in_queue": False}).status_code == 200
    assert in_queue(c, rec["id"]) == []
    assert c.get(f"/records/{rec['id']}", headers=h).json()["in_queue"] is False


def test_decisions_on_saved_records(signed_in):
    c, h = signed_in
    rec = c.post("/records", headers=h, json={"features": FEATURES}).json()
    body = {"decision": "accepted", "action": "Home-care referral & medication reconciliation"}

    # not on the queue yet -> no follow-up assignment
    assert c.post(f"/records/{rec['id']}/decision", headers=h, json=body).status_code == 409

    c.put(f"/records/{rec['id']}/queue", headers=h, json={"in_queue": True})
    assert c.post(f"/records/{rec['id']}/decision", headers=h, json=body).status_code == 201
    assert in_queue(c, rec["id"])[0]["decision"]["decision"] == "accepted"
    assert c.get(f"/records/{rec['id']}", headers=h).json()["decision"]["by"] == "Queue Test"


def test_delete_record_removes_it_and_its_decisions(signed_in):
    c, h = signed_in
    rec = c.post("/records", headers=h, json={"features": FEATURES, "add_to_queue": True}).json()
    c.post(f"/records/{rec['id']}/decision", headers=h,
           json={"decision": "overridden", "action": "Standard discharge instructions", "reason": "Test"})

    assert c.delete(f"/records/{rec['id']}").status_code == 401          # must be signed in
    assert c.delete(f"/records/{rec['id']}", headers=h).status_code == 204
    assert c.get(f"/records/{rec['id']}", headers=h).status_code == 404
    assert in_queue(c, rec["id"]) == []
    with ENGINE.connect() as conn:
        left = conn.execute(text("SELECT count(*) FROM queue_decisions WHERE record_id = :i"),
                            {"i": rec["id"]}).scalar()
    assert left == 0
    assert c.delete(f"/records/{rec['id']}", headers=h).status_code == 404
