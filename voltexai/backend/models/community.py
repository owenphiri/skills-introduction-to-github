"""Voltex Community — global trader wall posts."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text

from ..database import Base


class Post(Base):
    __tablename__ = "community_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    author = Column(String(80), nullable=False)
    country = Column(String(60), nullable=True)
    body = Column(Text, nullable=False)
    likes = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
