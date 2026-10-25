# cd ~/Desktop/F26_4495_S2_ThienN/Implementation/readmission
# source ../../.venv/bin/activate
# uvicorn api.main:app --reload

# cd ~/Desktop/F26_4495_S2_ThienN/Implementation/readmission
# cd web
# npm run dev

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from api.auth import router as auth_router
from api.db import init_db
from api.scoring import router as scoring_router

@asynccontextmanager
async def lifespan(app):
    init_db()   # creates users/sessions tables if missing
    yield

# comma-separated list; on Render set ALLOWED_ORIGINS to the deployed frontend URL
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(auth_router)
app.include_router(scoring_router)
 
# @app.get("/")
# def running():
#     return {"status": "API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}
