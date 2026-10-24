import os
from sqlalchemy import create_engine, text

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://readmit:readmit@localhost:5432/readmit")
ENGINE = create_engine(DATABASE_URL)

def init_db():
    """Create the users/sessions tables if they don't exist yet."""
    with ENGINE.begin() as conn:
        conn.execute(text(open("sql/users.sql").read()))
