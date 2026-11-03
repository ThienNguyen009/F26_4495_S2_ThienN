 # Predicting and Preventing 30-Day Hospital Readmissions

 <img width="1395" height="881" alt="Open Weather" src="https://github.com/user-attachments/assets/7ceeda42-0811-4980-a695-51cce32c576e" />


**Live preview:** https://f26-4495-s2-thien-n.vercel.app/

You can use this demo account to run my project, and one thing u forgot to tell you that u can save the user input into the dataset.

Email: quangthiennguyen1120@gmail.com
Password: Thien@1234567


First of all, as I shared with you a readmission within 30 days of discharge is one of the most closely watched numbers in healthcare. Medicare financially penalizes US hospitals whose 30-day rates exceed expected benchmarks, and Canadian health authorities, including those in British Columbia, report the same indicator through the Canadian Institute for Health Information. The cost is two fold like this, a second inpatient stay is expensive, and it usually signals that something in the first discharge, the medication list, the follow-up plan, the handover did not hold.
Hospitals already hold the data that would help: diagnosis, comorbidity count, length of stay, prior admissions, discharge disposition. What most lack is a systematic way to use it. Deciding who needs intensified follow-up still comes down to a checklist or a clinician’s judgment under time pressure. This project treats that gap as an analytics problem: turn the discharge record into an automatic risk screen that runs for every patient, every day.
And it also would be a website as you told me that has multiple features for third parties, or hospitals can use it to track and pay attention too high-risk patients like those people who have diabetes….
How does it work?
### The central question: 
which patient-level, clinical, and administrative factors are most strongly associated with 30-day readmission, and can a machine-learning classifier flag high-risk patients early enough, and clearly enough, for a discharge-planning team to intervene before the patient leaves?
1.	Readmissions are often preventable. A call, a home-care referral, or a medication review works, when it reaches the right patient. The hard part is knowing who that is while they are still on the ward.
2.	Follow-up capacity is finite. No hospital can intervene with every discharged patient, so any useful system has to rank them.
3.	A bare probability is not actionable. Staff need to know why a patient was flagged and what to do about it.

## Team
- Le Quang Thien Nguyen (Team Lead) (Solo)
  

## Running the project

All code lives in `Implementation/readmission`. Unless noted, run commands from that folder.

### Prerequisites
- Python 3.12
- Node.js 20+ and npm
- Docker (for the local PostgreSQL database)

### 1. Python environment
From the repository root:
```bash
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
cd Implementation/readmission
pip install -r requirements.txt    # full stack: ML, notebooks, API, tests
```
(`requirements-api.txt` is the smaller set used for the hosted API only.)

### 2. Start the database
```bash
docker compose up -d               # Postgres 16 on localhost:5432 (user/password/db: readmit)
```

### 3. Build the dataset and load it into Postgres (first run only)
```bash
python make_clean.py               # data/diabetic_data.csv -> data/clean.parquet
python -m ml.split                 # adds train/test split -> data/clean_split.parquet
python -m ml.load_db               # creates the schema and loads encounters into Postgres
docker compose exec -T db psql -U readmit -d readmit < sql/views.sql   # optional: analysis views
```
The notebooks in `notebooks/` (inspection, EDA, baseline models) can then be opened with `jupyter notebook`.

### 4. Run the backend API
```bash
uvicorn api.main:app --reload      # http://localhost:8000  (docs at /docs, health check at /health)
```
The user/session tables are created automatically on startup. Environment variables:
- `DATABASE_URL` – defaults to `postgresql+psycopg://readmit:readmit@localhost:5432/readmit`
- `ALLOWED_ORIGINS` – comma-separated CORS origins, defaults to `http://localhost:5173,http://localhost:5174`

### 5. Run the web frontend
In a second terminal:
```bash
cd Implementation/readmission/web
npm install
npm run dev                        # http://localhost:5173
```
The frontend calls the API at `http://localhost:8000` by default; set `VITE_API_URL` to point it elsewhere.

### 6. Run the tests
```bash
pytest                             # from Implementation/readmission
```

### Deployment
`render.yaml` at the repository root is a Render Blueprint that deploys the FastAPI backend with a managed Postgres database (Render dashboard → New → Blueprint). Set `ALLOWED_ORIGINS` to the deployed frontend URL.

## Folders
- **ReportsAndDocuments** – all reports and documentation
- **Implementation** – all code that will be checked in
- **Misc** – other files or folders for the team (delete this line if you skipped Misc)
