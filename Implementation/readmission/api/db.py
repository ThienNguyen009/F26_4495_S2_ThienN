import os
from pathlib import Path
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://readmit:readmit@localhost:5432/readmit")
# Render (and most hosts) hand out postgres:// or postgresql:// URLs; tell SQLAlchemy to use psycopg 3.
DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1).replace("postgresql://", "postgresql+psycopg://", 1)
ENGINE = create_engine(DATABASE_URL, pool_pre_ping=True)

USERS_SQL = Path(__file__).resolve().parent.parent / "sql" / "users.sql"

def init_db():
    """Create the users/sessions tables if they don't exist yet."""
    with ENGINE.begin() as conn:
        conn.execute(text(USERS_SQL.read_text()))
