"""
Voltex RL scoring layer — a self-optimizing contextual bandit over the signal
confluence components.

Model: online logistic regression predicting P(win) from the 0-1 component
vector. Each closed trade is a labelled reward (win/loss, weighted by |R|) that
nudges the weights via SGD, so the model continuously learns which components
actually produce winners and re-scores incoming setups accordingly.

Pure-Python, persisted in rl_model_state (single row) + rl_observations, so it
survives restarts and needs no ML dependencies.
"""
from __future__ import annotations

import json
import math
from datetime import datetime

from sqlalchemy.orm import Session

from ..models import RLModelState, RLObservation
from .signal_score import WEIGHTS

FEATURES = list(WEIGHTS.keys())
_LR = 0.15                 # learning rate
_CLIP = 6.0                # weight clamp
_CONF_K = 20               # updates needed before RL carries ~half the weight
_MAX_CONF = 0.7            # RL never fully overrides the deterministic base score


def _sigmoid(z: float) -> float:
    if z < -60:
        return 0.0
    if z > 60:
        return 1.0
    return 1.0 / (1.0 + math.exp(-z))


def _get_state(db: Session) -> RLModelState:
    st = db.get(RLModelState, 1)
    if not st:
        st = RLModelState(id=1, weights_json=json.dumps({f: 0.0 for f in FEATURES}), bias=0.0)
        db.add(st)
        db.commit()
        db.refresh(st)
    return st


def _weights(st: RLModelState) -> dict:
    w = json.loads(st.weights_json or "{}")
    return {f: float(w.get(f, 0.0)) for f in FEATURES}


def _predict(weights: dict, bias: float, x: dict) -> float:
    z = bias + sum(weights[f] * float(x.get(f, 0.0)) for f in FEATURES)
    return _sigmoid(z)


def confidence(updates: int) -> float:
    return min(_MAX_CONF, updates / (updates + _CONF_K))


def score(db: Session, comps: dict, base_score: float) -> dict:
    """RL probability-of-win → rl_score(0-100) and a blend with the base score."""
    st = _get_state(db)
    p = _predict(_weights(st), st.bias, comps)
    rl = round(p * 100, 1)
    conf = confidence(st.updates)
    combined = round(base_score * (1 - conf) + rl * conf, 1)
    return {"rl_score": rl, "combined_score": combined, "confidence": round(conf, 3),
            "updates": st.updates}


def record(db: Session, uuid: str, comps: dict, base: float, rl: float, combined: float):
    if db.query(RLObservation).filter(RLObservation.signal_uuid == uuid).first():
        return
    db.add(RLObservation(signal_uuid=uuid, features_json=json.dumps(comps),
                         base_score=base, rl_score=rl, combined_score=combined))
    db.commit()


def learn(db: Session, uuid: str, result_r: float) -> dict | None:
    """Label the observation with its outcome and take one SGD step."""
    obs = db.query(RLObservation).filter(RLObservation.signal_uuid == uuid).first()
    if not obs or obs.learned:
        return None
    x = json.loads(obs.features_json)
    y = 1.0 if result_r > 0 else 0.0
    sw = max(0.5, min(3.0, abs(result_r)))     # reward-weighted step

    st = _get_state(db)
    w = _weights(st)
    p = _predict(w, st.bias, x)
    err = (y - p) * _LR * sw
    for f in FEATURES:
        w[f] = max(-_CLIP, min(_CLIP, w[f] + err * float(x.get(f, 0.0))))
    st.bias = max(-_CLIP, min(_CLIP, st.bias + err))
    st.weights_json = json.dumps(w)
    st.updates += 1
    st.wins += int(y)
    st.updated_at = datetime.utcnow()
    obs.outcome = result_r
    obs.learned = True
    db.commit()
    return {"updates": st.updates, "win_rate": round(st.wins / st.updates * 100, 1)}


def model_view(db: Session) -> dict:
    st = _get_state(db)
    w = _weights(st)
    importance = sorted(
        [{"feature": f, "weight": round(w[f], 3),
          "signal": "predicts wins" if w[f] > 0.05 else "predicts losses" if w[f] < -0.05 else "neutral"}
         for f in FEATURES],
        key=lambda d: d["weight"], reverse=True)
    return {
        "updates": st.updates, "wins": st.wins,
        "win_rate": round(st.wins / st.updates * 100, 1) if st.updates else 0,
        "confidence": round(confidence(st.updates), 3),
        "bias": round(st.bias, 3), "importance": importance,
        "status": "learning" if st.updates < _CONF_K else "optimized",
    }
