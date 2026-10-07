### This one is cleaning and feature engineering. I used by training AND by the API 
import numpy as np
import pandas as pd

RAW_PATH = "data/diabetic_data.csv"

MEDS = ["metformin", "repaglinide", "nateglinide", "chlorpropamide", "glimepiride",
        "acetohexamide", "glipizide", "glyburide", "tolbutamide", "pioglitazone",
        "rosiglitazone", "acarbose", "miglitol", "troglitazone", "tolazamide",
        "examide", "citoglipton", "insulin", "glyburide-metformin",
        "glipizide-metformin", "glimepiride-pioglitazone",
        "metformin-rosiglitazone", "metformin-pioglitazone"]

#### these codes from IDS_mapping.csv.  i verify each one against the file 

EXPIRED_OR_HOSPICE = [11, 13, 14, 19, 20, 21]
UNKNOWN_DISPOSITION = [18, 25, 26]


DISPOSITION_GROUPS = {
    1: "Home",
    6: "Home with services", 8: "Home with services",
    7: "Left AMA",
    3: "Care facility", 4: "Care facility", 5: "Care facility",
    15: "Care facility", 22: "Care facility", 24: "Care facility",
    2: "Other hospital", 10: "Other hospital", 23: "Other hospital",
    27: "Other hospital", 28: "Other hospital", 29: "Other hospital",
}   #### anything else  means  "Other"

ADMISSION_SOURCE_GROUPS = {
    7: "Emergency room",
    1: "Referral", 2: "Referral", 3: "Referral",
    4: "Transfer", 5: "Transfer", 6: "Transfer", 10: "Transfer",
    18: "Transfer", 22: "Transfer", 25: "Transfer", 26: "Transfer",
    9: "Unknown", 15: "Unknown", 17: "Unknown", 20: "Unknown", 21: "Unknown",
}   # else "Other"

ADMISSION_TYPE_GROUPS = {1: "Emergency", 2: "Urgent", 3: "Elective", 7: "Trauma",
                         5: "Unknown", 6: "Unknown", 8: "Unknown"}   # else "Other"

TOP_SPECIALTIES = ["InternalMedicine", "Emergency/Trauma", "Family/GeneralPractice",
                   "Cardiology", "Surgery-General", "Nephrology", "Orthopedics",
                   "Orthopedics-Reconstructive", "Radiologist"]

### To confirm this list with df["medical_specialty"].value_counts().head(12) on my data

NUMERIC = ["age_num", "time_in_hospital", "num_lab_procedures", "num_procedures",
           "num_medications", "number_outpatient", "number_emergency",
           "number_inpatient", "number_diagnoses", "n_diabetes_meds",
           "n_med_changes", "total_prior_visits"]

CATEGORICAL = ["race", "gender", "admission_type", "admission_source",
               "disposition_group", "diag_1_group", "diag_2_group", "diag_3_group",
               "A1Cresult", "max_glu_serum", "insulin", "metformin", "change",
               "diabetesMed", "specialty_group"]



def icd9_group(code) -> str:
    """Collapse an ICD-9 code into a clinical group (grouping used by Strack et al. 2014)."""
    if pd.isna(code) or code == "":
        return "Missing"
    code = str(code)
    if code.startswith(("V", "E")):
        return "Other"
    num = float(code)
    if int(num) == 250:
        return "Diabetes"
    if 390 <= num < 460 or int(num) == 785:
        return "Circulatory"
    if 460 <= num < 520 or int(num) == 786:
        return "Respiratory"
    if 520 <= num < 580 or int(num) == 787:
        return "Digestive"
    if 800 <= num < 1000:
        return "Injury"
    if 710 <= num < 740:
        return "Musculoskeletal"
    if 580 <= num < 630 or int(num) == 788:
        return "Genitourinary"
    if 140 <= num < 240:
        return "Neoplasms"
    return "Other"

def load_raw(path: str = RAW_PATH) -> pd.DataFrame:
    return pd.read_csv(path, na_values=["?", ""], keep_default_na=False)


def filter_rows(df: pd.DataFrame) -> pd.DataFrame:
    """Training-time only: remove encounters that can't be readmitted or are invalid."""
    keep = (~df["discharge_disposition_id"].isin(EXPIRED_OR_HOSPICE + UNKNOWN_DISPOSITION)
            & (df["gender"] != "Unknown/Invalid"))
    return df[keep].copy()


def add_target(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["target"] = (df["readmitted"] == "<30").astype(int)
    return df


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Turn raw UCI-format rows into model features. Never drops rows."""
    df = df.copy()


### the age band  between "[70-80)" to 75
    df["age_num"] = df["age"].str.extract(r"\[(\d+)-")[0].astype(int) + 5


### this code groupings: 

    df["disposition_group"] = df["discharge_disposition_id"].map(DISPOSITION_GROUPS).fillna("Other")
    df["admission_type"] = df["admission_type_id"].map(ADMISSION_TYPE_GROUPS).fillna("Other")
    df["admission_source"] = df["admission_source_id"].map(ADMISSION_SOURCE_GROUPS).fillna("Other")
    for d in ["diag_1", "diag_2", "diag_3"]:
        df[f"{d}_group"] = df[d].apply(icd9_group)

###  Missing or rare categories
    df["race"] = df["race"].fillna("Unknown")
    df["specialty_group"] = np.where(df["medical_specialty"].isna(), "Missing",
                              np.where(df["medical_specialty"].isin(TOP_SPECIALTIES),
                                       df["medical_specialty"], "Other"))
    for col in ["A1Cresult", "max_glu_serum"]:
        df[col] = df[col].fillna("None")

    ### this is for medication summaries (computed only if the 23 drug columns are present,
    ### so  if the single patient form can send n_diabetes_meds / n_med_changes directly 

    if all(m in df.columns for m in MEDS):
        df["n_diabetes_meds"] = (df[MEDS] != "No").sum(axis=1)
        df["n_med_changes"] = df[MEDS].isin(["Up", "Down"]).sum(axis=1)

    df["total_prior_visits"] = (df["number_outpatient"] + df["number_emergency"]
                                + df["number_inpatient"])
    return df