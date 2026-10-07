import pandas as pd

def test_no_patient_in_two_partitions():
    df = pd.read_parquet("data/clean_split.parquet")
    p = {s: set(df.loc[df["split"] == s, "patient_nbr"]) for s in ["train", "val", "test"]}
    assert p["train"].isdisjoint(p["val"])
    assert p["train"].isdisjoint(p["test"])
    assert p["val"].isdisjoint(p["test"])

def test_no_dead_or_hospice_patients():
    df = pd.read_parquet("data/clean_split.parquet")
    assert not df["discharge_disposition_id"].isin([11, 13, 14, 19, 20, 21]).any()


    