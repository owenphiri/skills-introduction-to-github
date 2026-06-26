"""
VoltexAI - Directory routes (prop firms + brokers)
GET /api/directory/prop-firms          - list (filter by asset class)
GET /api/directory/prop-firms/{id}     - single firm
GET /api/directory/brokers             - list (filter by class, africa_only)
GET /api/directory/brokers/{id}        - single broker
GET /api/directory/compare             - quick side-by-side compare helper
"""
from fastapi import APIRouter, Query, HTTPException

from ..data.prop_firms import list_prop_firms, get_prop_firm
from ..data.brokers import list_brokers, get_broker

router = APIRouter(prefix="/api/directory", tags=["directory"])


@router.get("/prop-firms")
def prop_firms(asset_class: str = Query("all")):
    firms = list_prop_firms(asset_class)
    return {"count": len(firms), "firms": firms}


@router.get("/prop-firms/{firm_id}")
def prop_firm(firm_id: str):
    f = get_prop_firm(firm_id)
    if not f:
        raise HTTPException(404, "Prop firm not found")
    return f


@router.get("/brokers")
def brokers(asset_class: str = Query("all"), africa_only: bool = Query(False)):
    bs = list_brokers(asset_class, africa_only)
    return {"count": len(bs), "brokers": bs}


@router.get("/brokers/{broker_id}")
def broker(broker_id: str):
    b = get_broker(broker_id)
    if not b:
        raise HTTPException(404, "Broker not found")
    return b
