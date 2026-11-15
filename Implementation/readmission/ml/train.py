### Final model training. Every candidate is fit on train and compared on validation,
### then only the winner of each feature set is scored on the test set.
### Run from readmission/:  python -m ml.train

from itertools import product
from pathlib import Path

import joblib
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from xgboost import XGBClassifier

from ml.evaluate import evaluate, load_splits, make_preprocessor
from ml.features import CATEGORICAL, NUMERIC

MODEL_DIR = Path(__file__).resolve().parent.parent / "models"
RESULTS_DIR = Path(__file__).resolve().parent.parent / "results"

### "form" is only what the Score Patient form (PatientIn in api/scoring.py) can supply
FORM_NUMERIC = ["age_num", "time_in_hospital", "num_lab_procedures", "num_procedures",
                "num_medications", "number_outpatient", "number_emergency",
                "number_inpatient", "number_diagnoses", "total_prior_visits"]
FORM_CATEGORICAL = ["gender", "admission_type", "disposition_group", "diag_1_group",
                    "diag_2_group", "A1Cresult", "change"]

FEATURE_SETS = {"full": (NUMERIC, CATEGORICAL), "form": (FORM_NUMERIC, FORM_CATEGORICAL)}

XGB_GRID = {"max_depth": [3, 4, 5], "n_estimators": [200, 400]}


def candidates():
    ### no class weights or SMOTE: 03_baseline showed they don't improve ranking and they
    ### destroy calibration, and the app displays the probability itself
    yield "LR", LogisticRegression(max_iter=2000)
    for depth, trees in product(XGB_GRID["max_depth"], XGB_GRID["n_estimators"]):
        yield f"XGB (depth={depth}, trees={trees})", XGBClassifier(
            max_depth=depth, n_estimators=trees, learning_rate=0.03, subsample=0.8,
            colsample_bytree=0.8, min_child_weight=20, random_state=42)


def main():
    S = load_splits()
    MODEL_DIR.mkdir(exist_ok=True)
    val_rows, test_rows = [], []

    for set_name, (numeric, categorical) in FEATURE_SETS.items():
        cols = numeric + categorical
        fitted = {}
        rows = []
        for name, clf in candidates():
            pipe = Pipeline([("prep", make_preprocessor(numeric, categorical)), ("model", clf)])
            pipe.fit(S["train"][cols], S["train"]["target"])
            fitted[name] = pipe
            p = pipe.predict_proba(S["val"][cols])[:, 1]
            rows.append({"features": set_name, **evaluate(S["val"]["target"], p, name)})

        ### PR-AUC because the positive class is rare and the app's job is ranking patients
        best = max(rows, key=lambda r: r["pr_auc"])["model"]
        p = fitted[best].predict_proba(S["test"][cols])[:, 1]
        test_rows.append({"features": set_name, **evaluate(S["test"]["target"], p, best)})
        joblib.dump(fitted[best], MODEL_DIR / f"readmission_{set_name}.joblib")
        val_rows += rows

    val = pd.DataFrame(val_rows).round(4)
    test = pd.DataFrame(test_rows).round(4)
    val.to_csv(RESULTS_DIR / "final_model_validation.csv", index=False)
    test.to_csv(RESULTS_DIR / "final_model_test.csv", index=False)
    print(val.to_string(index=False), "\n\nTEST (winners only)\n", test.to_string(index=False))


if __name__ == "__main__":
    main()
