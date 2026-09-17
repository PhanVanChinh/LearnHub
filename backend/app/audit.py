"""Nhật ký hành động (audit log): ai làm gì, với đối tượng nào, lúc nào, từ IP nào.

Ghi cho mọi thao tác thay đổi dữ liệu trong khu admin và các thao tác nhạy cảm của người dùng (tự xoá tài khoản).
Bản ghi độc lập với đối tượng gốc (lưu email actor và tóm tắt dạng chữ) nên vẫn đọc được sau khi đối tượng bị xoá.
"""
from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditLog, User
from .ratelimit import client_ip


def record(db: Session, request: Request | None, actor: User | None, action: str, target_type: str = "",
           target_id: int | str | None = None, summary: str = "", detail: dict | None = None) -> AuditLog:
    """Thêm một dòng nhật ký và commit. Gọi SAU khi thao tác chính đã commit thành công."""
    entry = AuditLog(
        actor_id=actor.id if actor else None,
        actor_email=actor.email if actor else None,
        action=action, target_type=target_type,
        target_id=str(target_id) if target_id is not None else None,
        summary=summary[:500], detail=detail or None,
        ip=client_ip(request) if request is not None else None,
    )
    db.add(entry)
    db.commit()
    return entry
