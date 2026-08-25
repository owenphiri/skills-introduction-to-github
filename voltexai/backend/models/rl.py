"""
Voltex RL scoring — persisted online-learning model state + per-signal
observations that get labelled when the trade closes.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Float, Text, Boolean

from ..database import Base


class RLModelState(Base):
    """Singleton (id=1) holding the learned weights + running stats."""
    __tablename__ = "rl_model_state"

    id = Column(Integer, primary_key=True)          # always 1
    weights_json = Column(Text, nullable=False, default="{}")
    bias = Column(Float, nullable=False, default=0.0)
    updates = Column(Integer, nullable=False, default=0)
    wins = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class RLObservation(Base):
    """Feature vector + scores for one signal; outcome filled in when it closes."""
    __tablename__ = "rl_observations"

    id = Column(Integer, primary_key=True, index=True)
    signal_uuid = Column(String(64), unique=True, index=True, nullable=False)
    features_json = Column(Text, nullable=False)
    base_score = Column(Float, nullable=False, default=0)
    rl_score = Column(Float, nullable=False, default=0)
    combined_score = Column(Float, nullable=False, default=0)
    outcome = Column(Float, nullable=True)          # realised R once closed
    learned = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
