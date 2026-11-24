/* App tables, created on API startup (api/db.py init_db). Kept separate from schema.sql so
   reloading the data never wipes them. Every statement is safe to run again on an existing DB. */

/* App accounts for the web login. */
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    full_name     TEXT NOT NULL,
    organization  TEXT,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Records added from Score one patient ("Add to dataset" / "Add to queue"). Identity fields are kept
   for the ward record and audit only; `features` is exactly what the model scored. `outcome`
   (1 = readmitted within 30 days) stays NULL until it is known, then the record can join the
   retraining pool. `in_queue` puts the patient on the Discharge queue next to the demo cohort. */
CREATE TABLE IF NOT EXISTS scored_records (
    id            SERIAL PRIMARY KEY,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id       INT REFERENCES users(id) ON DELETE SET NULL,
    patient_name  TEXT,
    mrn           TEXT,
    encounter_ref TEXT,
    unit_bed      TEXT,
    race          TEXT,
    scored_by     TEXT,
    features      JSONB NOT NULL,
    probability   REAL NOT NULL,
    tier          TEXT NOT NULL,
    outcome       SMALLINT CHECK (outcome IN (0, 1))
);
ALTER TABLE scored_records ADD COLUMN IF NOT EXISTS in_queue  BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE scored_records ADD COLUMN IF NOT EXISTS queued_at TIMESTAMPTZ;

/* Discharge-planning decisions on queue patients: accept the recommended action or override it.
   A decision belongs to a demo encounter (encounter_id) or a saved record (record_id); deleting
   the record deletes its decisions. Every decision is kept; the latest one is the current status. */
CREATE TABLE IF NOT EXISTS queue_decisions (
    id           SERIAL PRIMARY KEY,
    encounter_id BIGINT,
    user_id      INT REFERENCES users(id) ON DELETE SET NULL,
    decision     TEXT NOT NULL CHECK (decision IN ('accepted', 'overridden')),
    action       TEXT NOT NULL,
    reason       TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE queue_decisions ALTER COLUMN encounter_id DROP NOT NULL;
ALTER TABLE queue_decisions ADD COLUMN IF NOT EXISTS record_id INT REFERENCES scored_records(id) ON DELETE CASCADE;

/* One row per login; the token is what the browser keeps. */
CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    user_id    INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
