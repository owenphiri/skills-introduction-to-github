"""User model."""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Enum as SAEnum
from sqlalchemy.orm import relationship
import enum
from ..database import Base


class UserRole(str, enum.Enum):
    USER = "user"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(120), nullable=True)
    country = Column(String(60), nullable=True)          # default useful for ZM market segmentation
    phone = Column(String(40), nullable=True)            # mobile-money number (E.164)
    role = Column(SAEnum(UserRole), default=UserRole.USER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    subscription = relationship("Subscription", back_populates="user",
                                uselist=False, cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user",
                            cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user",
                                 cascade="all, delete-orphan")
