"""Cấu hình chung cho test: dùng SQLite riêng và làm mới DB cho mỗi module test."""
import os
from pathlib import Path

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

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
