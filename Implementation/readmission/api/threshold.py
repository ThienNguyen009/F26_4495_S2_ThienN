### Threshold & cost: serves the precision / recall / flagged-share curve measured on the
### validation split (api/threshold_curve.json, written by ml/make_threshold_curve.py).
### Cost assumptions are applied in the browser so staff can change them freely.

import json
from pathlib import Path

from fastapi import APIRouter

router = APIRouter()

CURVE = json.loads((Path(__file__).resolve().parent / "threshold_curve.json").read_text())


@router.get("/threshold")
def threshold():
    return CURVE
