"""VoltexAI - mailing: newsletter subscribers, send log, and broadcast campaigns."""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text

from ..database import Base


class NewsletterSubscriber(Base):
    __tablename__ = "newsletter_subscribers"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    name = Column(String(120), nullable=True)
    locale = Column(String(8), default="en", nullable=False)
    source = Column(String(40), default="site", nullable=False)   # footer, signup, api…
    confirmed = Column(Boolean, default=True, nullable=False)      # double opt-in ready
    unsubscribed = Column(Boolean, default=False, nullable=False)
    unsubscribe_token = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_emailed_at = Column(DateTime, nullable=True)


class EmailLog(Base):
    __tablename__ = "email_log"

    id = Column(Integer, primary_key=True, index=True)
    to_email = Column(String(255), index=True, nullable=False)
    subject = Column(String(255), nullable=False)
    kind = Column(String(40), default="transactional", nullable=False)  # welcome, digest, broadcast…
    status = Column(String(16), default="sent", nullable=False)          # sent | failed
    error = Column(String(300), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Campaign(Base):
    __tablename__ = "email_campaigns"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(140), nullable=False)
    subject = Column(String(255), nullable=False)
    body_html = Column(Text, nullable=False)
    segment = Column(String(40), default="all", nullable=False)   # all | confirmed
    kind = Column(String(40), default="broadcast", nullable=False)
    status = Column(String(16), default="draft", nullable=False)  # draft | sending | sent
    recipients = Column(Integer, default=0, nullable=False)
    sent_count = Column(Integer, default=0, nullable=False)
    failed_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    sent_at = Column(DateTime, nullable=True)
