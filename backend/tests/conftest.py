"""Cấu hình chung cho test. Mặc định SQLite (nhanh). TEST_DB=postgres → Postgres nhúng (pgserver) hoặc TEST_DATABASE_URL có sẵn.

    python -m pytest -q                       # SQLite
    TEST_DB=postgres python -m pytest -q      # Postgres 16 nhúng, tự khởi động/tắt (cần requirements-dev.txt)
    TEST_DATABASE_URL=postgresql://... pytest # Postgres bên ngoài (CI dùng service container)
"""
import os
import tempfile
from pathlib import Path

_pg = None
if os.environ.get("TEST_DATABASE_URL"):
    os.environ["DATABASE_URL"] = os.environ["TEST_DATABASE_URL"]
elif os.environ.get("TEST_DB", "").lower() in ("postgres", "pg"):
    import pgserver

    _pg = pgserver.get_server(Path(tempfile.mkdtemp(prefix="learnhub-pg-")))
    os.environ["DATABASE_URL"] = _pg.get_uri()
else:
    os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["MAIL_PROVIDER"] = "console"  # không gửi mail thật khi test, kể cả khi .env có RESEND_API_KEY
os.environ["RATE_LIMIT_ENABLED"] = "false"  # test rate limit tự bật riêng trong test_abuse.py
os.environ["TURNSTILE_SECRET_KEY"] = ""

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(scope="module")
def client():
    Base.metadata.drop_all(bind=engine)
    with TestClient(app) as c:  # lifespan: create_all + seed
        yield c
    Base.metadata.drop_all(bind=engine)


def pytest_sessionfinish(session, exitstatus):
    engine.dispose()
    Path("test.db").unlink(missing_ok=True)
    if _pg is not None:
        _pg.cleanup()
