"""
VoltexAI - KYC (Know-Your-Customer) record
One verification record per user. Stores the submitted identity details and a
review status. Document files themselves are referenced by URL (upload to object
storage in production); we never store raw ID images in the app DB.
"""
from datetime import datetime
import enum

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship

from ..database import Base


class KycStatus(str, enum.Enum):
    NONE = "none"
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class KycRecord(Base):
    __tablename__ = "kyc_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    status = Column(SAEnum(KycStatus), default=KycStatus.PENDING, nullable=False)
    full_legal_name = Column(String(160), nullable=False)
    date_of_birth = Column(String(20), nullable=True)
    country = Column(String(60), nullable=True)
    document_type = Column(String(40), nullable=True)     # passport | national_id | drivers_license
    document_number = Column(String(80), nullable=True)
    document_url = Column(String(500), nullable=True)      # link to uploaded scan
    reject_reason = Column(String(300), nullable=True)
    submitted_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reviewed_at = Column(DateTime, nullable=True)

    user = relationship("User")
