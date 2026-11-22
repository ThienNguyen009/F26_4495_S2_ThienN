### Writes api/threshold_curve.json: precision / recall / share flagged at every candidate
### alert threshold, measured on the VALIDATION split with the deployed form model.
### The Threshold & cost page reads it through GET /threshold (data/ isn't deployed,
### so the numbers are precomputed here). Run from readmission/:  python -m ml.make_threshold_curve

import json
from pathlib import Path

import joblib
import numpy as np
from sklearn.metrics import average_precision_score

from ml.evaluate import load_splits

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "api" / "threshold_curve.json"


def main():
    bundle = joblib.load(ROOT / "models" / "readmission_form.joblib")
    pipe = bundle["pipeline"]
    val = load_splits()["val"]
    y = val["target"].to_numpy()
    p = pipe.predict_proba(val[list(pipe.feature_names_in_)])[:, 1]

    points = []
    for t in np.round(np.arange(0.02, p.max(), 0.005), 3):
        flagged = p >= t
        if flagged.sum() < 20:          # too few patients for a stable precision
            break
        tp = int((flagged & (y == 1)).sum())
        points.append({
            "threshold": float(t),
            "flagged": round(float(flagged.mean()), 4),
            "recall": round(tp / int(y.sum()), 4),
            "precision": round(tp / int(flagged.sum()), 4),
        })

    out = {
        "split": "validation",
        "n": int(len(y)),
        "base_rate": round(float(y.mean()), 4),
        "pr_auc": round(float(average_precision_score(y, p)), 4),
        "high_threshold": round(bundle["high_threshold"], 4),
        "medium_threshold": round(bundle["medium_threshold"], 4),
        "points": points,
    }
    OUT.write_text(json.dumps(out, indent=1))
    print(f"Wrote {len(points)} points to {OUT} (base rate {out['base_rate']:.3f}, PR-AUC {out['pr_auc']:.3f})")


if __name__ == "__main__":
    main()
