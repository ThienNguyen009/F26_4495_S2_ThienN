
### Import the libraries : 
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import (roc_auc_score, average_precision_score, precision_score,
                             recall_score, brier_score_loss)
from ml.features import NUMERIC, CATEGORICAL


FEATURES = NUMERIC + CATEGORICAL

def load_splits(path="data/clean_split.parquet"):
    df = pd.read_parquet(path)
    return {s: df[df["split"] == s].reset_index(drop=True) for s in ["train", "val", "test"]}


def make_preprocessor():
    return ColumnTransformer([
        ("num", StandardScaler(), NUMERIC),
        ("cat", OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=50,
                              sparse_output=False), CATEGORICAL),
    ])

def precision_at_top(y, p, share=0.20):
    """Of the top `share` highest-risk patients, what fraction were readmitted?"""
    k = int(len(p) * share)
    top = np.argsort(-p)[:k]
    return np.asarray(y)[top].mean()


def evaluate(y, p, name="", threshold=0.5):
    y, p = np.asarray(y), np.asarray(p)
    pred = (p >= threshold).astype(int)
    return {
        "model": name,
        "roc_auc": roc_auc_score(y, p),
        "pr_auc": average_precision_score(y, p),
        "precision_at_top20": precision_at_top(y, p, 0.20),
        "recall_at_0.5": recall_score(y, pred),
        "precision_at_0.5": precision_score(y, pred, zero_division=0),
        "flagged_share_at_0.5": pred.mean(),
        "brier": brier_score_loss(y, p),
        "mean_predicted": p.mean(),
        "base_rate": y.mean(),
    }
