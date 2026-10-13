import pandas as pd
from sqlalchemy import create_engine, text
from ml.features import DISPOSITION_GROUPS

ENGINE = create_engine("postgresql+psycopg://readmit:readmit@localhost:5432/readmit")

def read_mapping(path="data/IDS_mapping.csv"):
    """IDS_mapping.csv holds three tables stacked in one file.
    A line whose first field ends in '_id' starts a new table; separator lines
    (blank or just ',') are skipped. Works with Windows or Unix line endings."""
    out, key, rows = {}, None, []
    for line in open(path, encoding="utf-8").read().splitlines():
        first, _, rest = line.partition(",")
        first = first.strip()
        if first.endswith("_id"):
            if key:
                out[key] = pd.DataFrame(rows, columns=["id", "description"])
            key, rows = first, []
        elif first.isdigit():
            rows.append((int(first), rest.strip().strip('"')))
    if key:
        out[key] = pd.DataFrame(rows, columns=["id", "description"])
    return out

df = pd.read_parquet("data/clean_split.parquet")
maps = read_mapping()

with ENGINE.begin() as conn:
    conn.execute(text(open("sql/schema.sql").read()))

dispo = maps["discharge_disposition_id"].rename(columns={"id": "disposition_id"})
dispo["disposition_group"] = dispo["disposition_id"].map(DISPOSITION_GROUPS).fillna("Other")
dispo.to_sql("dim_disposition", ENGINE, if_exists="append", index=False)

maps["admission_type_id"].rename(columns={"id": "admission_type_id"}) \
    .to_sql("dim_admission_type", ENGINE, if_exists="append", index=False)
maps["admission_source_id"].rename(columns={"id": "admission_source_id"}) \
    .to_sql("dim_admission_source", ENGINE, if_exists="append", index=False)

# This one is one row for per patient which is race/gender from their first encounter


df.sort_values("encounter_id").drop_duplicates("patient_nbr")[["patient_nbr", "race", "gender"]] \
    .to_sql("dim_patient", ENGINE, if_exists="append", index=False)

enc = df.rename(columns={"age": "age_band", "A1Cresult": "a1c_result"})
cols = [c for c in pd.read_sql("SELECT * FROM encounters LIMIT 0", ENGINE).columns]
enc[cols].to_sql("encounters", ENGINE, if_exists="append", index=False, chunksize=5000)
print("Loaded", len(enc), "encounters")

