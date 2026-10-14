# cd ~/Desktop/F26_4495_S2_ThienN/Implementation/readmission
# source ../../.venv/bin/activate
# uvicorn api.main:app --reload

# cd ~/Desktop/F26_4495_S2_ThienN/Implementation/readmission
# cd web
# npm run dev

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])
 
# @app.get("/")
# def running():
#     return {"status": "API is running"}

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict():
    return {"probability": 0.999, "tier": "Highest Level hahaha"}   # this one I just fake for now