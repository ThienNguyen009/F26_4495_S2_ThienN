### here simple email + password auth: register, login, and "who am I".
### and this is passwords are hashed with PBKDF2 (stdlib), logins get a random token stored in the sessions table.

import hashlib
import hmac
import secrets

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from api.db import ENGINE

router = APIRouter(prefix="/auth")

ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return f"{salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    salt, digest = stored.split("$")
    check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), ITERATIONS).hex()
    return hmac.compare_digest(check, digest)


# field names match what the React forms send (web/src/api/auth.ts)
class RegisterIn(BaseModel):
    fullName: str = Field(min_length=1)
    organization: str = ""
    email: str = Field(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=8)


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/register", status_code=201)
def register(body: RegisterIn):
    try:
        with ENGINE.begin() as conn:
            user_id = conn.execute(
                text("""INSERT INTO users (full_name, organization, email, password_hash)
                        VALUES (:name, :org, :email, :hash) RETURNING id"""),
                {"name": body.fullName.strip(), "org": body.organization.strip() or None,
                 "email": body.email.strip().lower(), "hash": hash_password(body.password)},
            ).scalar_one()
    except IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    return {"id": user_id}


@router.post("/login")
def login(body: LoginIn):
    with ENGINE.begin() as conn:
        user = conn.execute(
            text("SELECT id, password_hash FROM users WHERE email = :email"),
            {"email": body.email.strip().lower()},
        ).first()
        # same message for unknown email and wrong password
        if user is None or not verify_password(body.password, user.password_hash):
            raise HTTPException(401, "Incorrect email or password")
        token = secrets.token_urlsafe(32)
        conn.execute(text("INSERT INTO sessions (token, user_id) VALUES (:t, :u)"), {"t": token, "u": user.id})
    return {"access_token": token, "token_type": "bearer"}


def bearer_token(authorization: str) -> str:
    return authorization.removeprefix("Bearer ").strip()


@router.post("/logout")
def logout(authorization: str = Header(default="")):
    with ENGINE.begin() as conn:
        conn.execute(text("DELETE FROM sessions WHERE token = :t"), {"t": bearer_token(authorization)})
    return {"ok": True}


@router.get("/me")
def me(authorization: str = Header(default="")):
    token = bearer_token(authorization)
    with ENGINE.connect() as conn:
        user = conn.execute(
            text("""SELECT u.id, u.full_name, u.organization, u.email
                    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = :t"""),
            {"t": token},
        ).first()
    if user is None:
        raise HTTPException(401, "Not signed in")
    return {"id": user.id, "fullName": user.full_name, "organization": user.organization, "email": user.email}
