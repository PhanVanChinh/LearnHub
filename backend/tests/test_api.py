import os

os.environ["DATABASE_URL"] = "sqlite:///./test.db"

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app

Path("test.db").unlink(missing_ok=True)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c
    Path("test.db").unlink(missing_ok=True)


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_register_login_me(client):
    r = client.post("/api/auth/register", json={"email": "sv@phenikaa.edu.vn", "full_name": "Sinh Viên", "password": "secret123"})
    assert r.status_code == 201, r.text
    token = r.json()["access_token"]
    assert r.json()["user"]["role"] == "user"

    # trùng email
    assert client.post("/api/auth/register", json={"email": "SV@phenikaa.edu.vn", "full_name": "x", "password": "secret123"}).status_code == 409

    # sai mật khẩu
    assert client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "wrong"}).status_code == 401

    r = client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "secret123"})
    assert r.status_code == 200

    assert client.get("/api/auth/me").status_code == 401
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == "sv@phenikaa.edu.vn"


def test_admin_seeded(client):
    r = client.post("/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"


def test_courses(client):
    all_ = client.get("/api/courses").json()
    assert len(all_) >= 20
    quiz = client.get("/api/courses", params={"category": "quiz"}).json()
    assert quiz and all("quiz" in c["tags"] for c in quiz)
    free = client.get("/api/courses", params={"category": "free"}).json()
    assert free and all(c["price"] == 0 for c in free)
    assert client.get("/api/courses", params={"q": "python"}).json()
    cats = {c["key"]: c["count"] for c in client.get("/api/courses/categories").json()}
    assert cats["all"] == len(all_) and cats["quiz"] == len(quiz)

    slug = free[0]["slug"]
    d = client.get(f"/api/courses/{slug}").json()
    assert d["lessons"] and d["enrolled"] is False
    assert client.get("/api/courses/khong-ton-tai").status_code == 404


def test_enroll_flow(client):
    token = client.post("/api/auth/login", json={"email": "sv@phenikaa.edu.vn", "password": "secret123"}).json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}
    free = client.get("/api/courses", params={"category": "free"}).json()[0]["slug"]
    paid = next(c for c in client.get("/api/courses").json() if c["price"] > 0)["slug"]

    assert client.post(f"/api/courses/{free}/enroll").status_code == 401
    assert client.post(f"/api/courses/{paid}/enroll", headers=h).status_code == 402
    r = client.post(f"/api/courses/{free}/enroll", headers=h)
    assert r.status_code == 201 and r.json()["enrolled"] is True
    assert client.get(f"/api/courses/{free}", headers=h).json()["enrolled"] is True
    mine = client.get("/api/courses/me/enrolled", headers=h).json()
    assert [c["slug"] for c in mine] == [free]
