"""Trang tài khoản: tự sửa hồ sơ."""


def _register(client, email, name="Người Dùng", password="MatKhau2024"):
    r = client.post("/api/auth/register", json={"email": email, "full_name": name, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_update_full_name(client):
    h = _register(client, "acc@example.com")
    assert client.patch("/api/auth/me", json={"full_name": "Tên Mới"}).status_code == 401

    r = client.patch("/api/auth/me", json={"full_name": "  Nguyễn   Văn  A "}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["full_name"] == "Nguyễn Văn A"
    assert client.get("/api/auth/me", headers=h).json()["full_name"] == "Nguyễn Văn A"

    # tên rỗng → 422 gắn đúng trường
    r = client.patch("/api/auth/me", json={"full_name": "   "}, headers=h)
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "full_name"
