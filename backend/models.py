"""
FILE: backend/models.py
SQLAlchemy database models.
"""

from sqlalchemy import Column, String, Text, DateTime, Boolean, Float, Integer, JSON, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base
import uuid
from datetime import datetime


def gen_uuid():
    return str(uuid.uuid4())


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=True)
    model_used = Column(String, default="auto")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=gen_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)  # "user" | "assistant" | "system"
    content = Column(Text, nullable=False)
    model_used = Column(String, nullable=True)
    confidence = Column(Float, nullable=True)
    sources_count = Column(Integer, default=0)
    metadata_ = Column("metadata", JSON, default={})
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation = relationship("Conversation", back_populates="messages")


class UploadedFile(Base):
    __tablename__ = "uploaded_files"

    id = Column(String, primary_key=True, default=gen_uuid)
    filename = Column(String, nullable=False)
    original_name = Column(String, nullable=False)
    file_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    content_summary = Column(Text, nullable=True)
    is_knowledge_base = Column(Boolean, default=False)
    trust_level = Column(Integer, default=2)  # 1=low, 2=medium, 3=high
    created_at = Column(DateTime, default=datetime.utcnow)


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(String, primary_key=True, default=gen_uuid)
    title = Column(String, nullable=False)
    source = Column(String, nullable=True)
    file_id = Column(String, ForeignKey("uploaded_files.id"), nullable=True)
    trust_level = Column(Integer, default=2)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserMemory(Base):
    __tablename__ = "user_memories"

    id = Column(String, primary_key=True, default=gen_uuid)
    key = Column(String, nullable=False)
    value = Column(Text, nullable=False)
    category = Column(String, default="general")  # preferences, facts, habits, etc.
    confidence = Column(Float, default=1.0)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)


class MonitorAlert(Base):
    __tablename__ = "monitor_alerts"

    id = Column(String, primary_key=True, default=gen_uuid)
    topic = Column(String, nullable=False)
    query = Column(Text, nullable=False)
    interval_minutes = Column(Integer, default=60)
    is_active = Column(Boolean, default=True)
    last_check = Column(DateTime, nullable=True)
    last_result = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertNotification(Base):
    __tablename__ = "alert_notifications"

    id = Column(String, primary_key=True, default=gen_uuid)
    alert_id = Column(String, ForeignKey("monitor_alerts.id"), nullable=False)
    summary = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GeneratedFile(Base):
    __tablename__ = "generated_files"

    id = Column(String, primary_key=True, default=gen_uuid)
    filename = Column(String, nullable=False)
    file_type = Column(String, nullable=False)  # pdf, docx, xlsx, png, etc.
    description = Column(Text, nullable=True)
    url_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
