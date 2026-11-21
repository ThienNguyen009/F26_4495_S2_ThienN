### Writes api/demo_cohort.csv: a fixed sample of held-out test encounters that the
### Discharge queue page scores as "today's discharges". Only the form fields are kept
### (no outcome column), so the queue can't leak whether a patient came back.
### Run from readmission/:  python -m ml.make_demo_cohort

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "api" / "demo_cohort.csv"
N = 42

COLUMNS = ["encounter_id", "age_band", "gender", "admission_type", "time_in_hospital",
           "disposition_group", "number_inpatient", "number_emergency", "number_outpatient",
           "diag_1_group", "diag_2_group", "number_diagnoses", "num_lab_procedures",
           "num_procedures", "num_medications", "A1Cresult", "change"]


def main():
    df = pd.read_parquet(ROOT / "data" / "clean_split.parquet")
    test = df[df["split"] == "test"].rename(columns={"age": "age_band"})
    test = test[test["time_in_hospital"].between(1, 14) & test["number_diagnoses"].between(1, 16)]
    test.sample(N, random_state=7)[COLUMNS].to_csv(OUT, index=False)
    print(f"Wrote {N} encounters to {OUT}")


if __name__ == "__main__":
    main()
