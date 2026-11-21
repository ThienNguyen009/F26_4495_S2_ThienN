from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_queue_is_ranked_and_counted():
    body = client.get("/queue").json()
    probs = [p["probability"] for p in body["patients"]]
    assert len(probs) == 42
    assert probs == sorted(probs, reverse=True)
    assert sum(body["counts"].values()) == len(probs)
    assert {p["tier"] for p in body["patients"]} <= {"low", "medium", "high"}


def test_queue_tiers_match_thresholds():
    body = client.get("/queue").json()
    for p in body["patients"]:
        if p["tier"] == "high":
            assert p["probability"] >= body["high_threshold"] - 0.01
        assert p["action"] == body["actions"][p["tier"]]
