from fastapi.testclient import TestClient
from api.main import app

client = TestClient(app)


def test_threshold_curve_is_monotone():
    body = client.get("/threshold").json()
    assert body["split"] == "validation"
    pts = body["points"]
    assert len(pts) > 10
    # raising the threshold can only flag fewer patients and catch fewer readmissions
    for a, b in zip(pts, pts[1:]):
        assert b["threshold"] > a["threshold"]
        assert b["flagged"] <= a["flagged"]
        assert b["recall"] <= a["recall"]
    assert all(0 <= p["precision"] <= 1 for p in pts)


def test_flagging_everyone_gives_base_rate_precision():
    body = client.get("/threshold").json()
    first = body["points"][0]
    assert first["flagged"] == 1.0
    assert abs(first["precision"] - body["base_rate"]) < 1e-3
