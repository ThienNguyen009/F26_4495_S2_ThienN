# Implementation

React (Vite + TypeScript) front-end over a FastAPI + scikit-learn/XGBoost/SHAP service, backed by PostgreSQL.

```
backend/      Python package `readmit` (ML pipeline + API), managed with uv
  src/readmit/  config, db, data, features, models, explain, decision, api
  tests/        pytest
  notebooks/    EDA notebooks (import from readmit)
frontend/     React app — five screens: intake, queue, patient detail, model & fairness, thresholds & cost
db/           schema.sql (star schema)
data/         raw/ and processed/ datasets (gitignored)
artifacts/    trained model files (gitignored)
```

## One-time setup (macOS)

```bash
brew install uv node postgresql@16 libomp
brew services start postgresql@16
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"   # add to ~/.zshrc
createdb readmit
psql readmit -f db/schema.sql

cp .env.example .env
cd backend && uv sync && cd ..
cd frontend && npm install && cd ..
```

Dataset: download https://archive.ics.uci.edu/dataset/296, unzip, and put `diabetic_data.csv` and `IDS_mapping.csv` in `data/raw/`.

## Run

```bash
cd backend  && uv run uvicorn readmit.api.main:app --reload   # http://localhost:8000/docs
cd frontend && npm run dev                                     # http://localhost:5173 (proxies /api)
```

## Test and lint

```bash
cd backend
uv run pytest                                   # all tests
uv run pytest tests/test_health.py::test_health # one test
uv run ruff check .
```
