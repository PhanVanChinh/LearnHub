"""Lưu file tài liệu bài học trên object storage tương thích S3 (Cloudflare R2, Backblaze B2, MinIO, AWS S3).

Không cấu hình S3_* → enabled() False: admin chỉ đính kèm được link ngoài. File không bao giờ public: người học nhận
URL ký có hạn (mặc định 10 phút) qua API sau khi backend kiểm tra quyền (bài free hoặc đã ghi danh).
"""
import logging
import re
import unicodedata
import uuid

from fastapi import HTTPException, status

from .config import settings

log = logging.getLogger("learnhub.storage")

ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/zip": "zip", "application/x-zip-compressed": "zip",
    "text/plain": "txt", "text/markdown": "md", "text/csv": "csv",
    "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
}


def enabled() -> bool:
    return bool(settings.s3_endpoint_url and settings.s3_bucket and settings.s3_access_key_id and settings.s3_secret_access_key)


def _client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3", endpoint_url=settings.s3_endpoint_url, region_name=settings.s3_region or "auto",
        aws_access_key_id=settings.s3_access_key_id, aws_secret_access_key=settings.s3_secret_access_key,
        config=Config(signature_version="s3v4"),
    )


def safe_filename(name: str) -> str:
    base = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    base = re.sub(r"[^A-Za-z0-9._-]+", "-", base)
    base = re.sub(r"-+\.", ".", re.sub(r"-{2,}", "-", base)).strip("-.") or "file"  # "cuoi-.pdf" → "cuoi.pdf"
    return base[:100]


def make_key(course_slug: str, filename: str, prefix: str = "courses") -> str:
    return f"{prefix}/{course_slug}/{uuid.uuid4().hex[:12]}-{safe_filename(filename)}"


def put(key: str, data: bytes, content_type: str) -> None:
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Chưa cấu hình lưu trữ file (S3_*). Hiện chỉ đính kèm được link ngoài")
    try:
        _client().put_object(Bucket=settings.s3_bucket, Key=key, Body=data, ContentType=content_type)
    except Exception as e:  # boto ném nhiều loại lỗi khác nhau
        log.error("Upload %s thất bại: %s", key, e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Không tải được file lên kho lưu trữ, thử lại sau")


def presigned_get(key: str, filename: str, expires: int | None = None) -> str:
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kho lưu trữ file chưa được cấu hình")
    try:
        return _client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": key,
                    "ResponseContentDisposition": f'attachment; filename="{safe_filename(filename)}"'},
            ExpiresIn=expires or settings.s3_link_expire_seconds,
        )
    except Exception as e:
        log.error("Ký link %s thất bại: %s", key, e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Không tạo được link tải, thử lại sau")


def get(key: str) -> tuple[bytes, str]:
    """Đọc object về bộ nhớ (ảnh bìa nhỏ). Trả (bytes, content-type)."""
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Kho lưu trữ file chưa được cấu hình")
    try:
        obj = _client().get_object(Bucket=settings.s3_bucket, Key=key)
        return obj["Body"].read(), obj.get("ContentType") or "application/octet-stream"
    except Exception as e:
        log.warning("Không đọc được %s: %s", key, e)
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy ảnh")


def delete(key: str) -> None:
    if not enabled():
        return
    try:
        _client().delete_object(Bucket=settings.s3_bucket, Key=key)
    except Exception as e:
        log.warning("Xoá %s thất bại: %s", key, e)
