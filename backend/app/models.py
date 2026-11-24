"""SQLAlchemy tables."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String(60), default="", index=True)
    name: Mapped[str] = mapped_column(String(80), default="")
    email: Mapped[str] = mapped_column(String(200), default="", index=True)
    password_hash: Mapped[str] = mapped_column(String(200), default="")
    plan: Mapped[str] = mapped_column(String(20), default="free")  # "free" | "pro"
    avatar_url: Mapped[str] = mapped_column(Text, default="")
    reset_code: Mapped[str] = mapped_column(String(12), default="")
    reset_expires: Mapped[str] = mapped_column(String(40), default="")
    is_verified: Mapped[int] = mapped_column(Integer, default=0)
    profile: Mapped[dict] = mapped_column(JSON, default=dict)
    daily_digest: Mapped[int] = mapped_column(Integer, default=0)  # 1 = opted in to the n8n daily message
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    conversations: Mapped[list["Conversation"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(120), default="New conversation")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    user: Mapped[User] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(16))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    muscle: Mapped[str | None] = mapped_column(String(40), nullable=True)
    sources: Mapped[list] = mapped_column(JSON, default=list)
    flags: Mapped[list] = mapped_column(JSON, default=list)
    rating: Mapped[int] = mapped_column(Integer, default=0)  # -1, 0, 1
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    provider: Mapped[str] = mapped_column(String(40), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    kind: Mapped[str] = mapped_column(String(30), default="bug")  # bug | wrong_answer | idea | other
    text: Mapped[str] = mapped_column(Text)
    page: Mapped[str] = mapped_column(String(200), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
