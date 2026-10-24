import uuid
from fastapi.testclient import TestClient
from sqlalchemy import text
from api.db import ENGINE
from api.main import app

# needs the docker-compose Postgres running

def test_register_login_me():
    email = f"test-{uuid.uuid4().hex[:8]}@example.com"
    with TestClient(app) as client:
        r = client.post("/auth/register", json={"fullName": "Test User", "organization": "",
                                                "email": email, "password": "password123"})
        assert r.status_code == 201

        # duplicate email is rejected
        r = client.post("/auth/register", json={"fullName": "Test User", "email": email, "password": "password123"})
        assert r.status_code == 409

        assert client.post("/auth/login", json={"email": email, "password": "wrongpass"}).status_code == 401

        r = client.post("/auth/login", json={"email": email.upper(), "password": "password123"})
        assert r.status_code == 200
        token = r.json()["access_token"]

        r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.json()["email"] == email
        assert client.get("/auth/me").status_code == 401

        # after logout the token no longer works
        client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
        assert client.get("/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401

    with ENGINE.begin() as conn:
        conn.execute(text("DELETE FROM users WHERE email = :e"), {"e": email})

def test_register_validates_input():
    with TestClient(app) as client:
        r = client.post("/auth/register", json={"fullName": "X", "email": "not-an-email", "password": "short"})
        assert r.status_code == 422
