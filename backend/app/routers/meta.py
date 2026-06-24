from fastapi import APIRouter

from app.codebook import METRIC_DEFINITIONS

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("/metrics")
def get_metrics() -> list[dict]:
    """Return the full metric definitions from codebook v1.

    Public endpoint — no auth required.  Consumers (frontend, external tools)
    can use this to stay in sync with backend thresholds and field names without
    hardcoding them locally.
    """
    return METRIC_DEFINITIONS
