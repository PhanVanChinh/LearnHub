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


def test_change_password(client):
    h = _register(client, "pw.user@example.com", password="MatKhau2024")
    url = "/api/auth/change-password"
    assert client.post(url, json={"current_password": "x", "new_password": "MatKhauMoi2024"}).status_code == 401
    # sai mật khẩu hiện tại
    r = client.post(url, json={"current_password": "sai-roi", "new_password": "MatKhauMoi2024"}, headers=h)
    assert r.status_code == 400 and "hiện tại" in r.json()["detail"]
    # trùng mật khẩu cũ
    r = client.post(url, json={"current_password": "MatKhau2024", "new_password": "MatKhau2024"}, headers=h)
    assert r.status_code == 400 and "khác" in r.json()["detail"]
    # chứa tên email
    r = client.post(url, json={"current_password": "MatKhau2024", "new_password": "pw.user-2024"}, headers=h)
    assert r.status_code == 400 and "email" in r.json()["detail"].lower()
    # quá yếu → 422 từ schema
    assert client.post(url, json={"current_password": "MatKhau2024", "new_password": "short"}, headers=h).status_code == 422

    r = client.post(url, json={"current_password": "MatKhau2024", "new_password": "MatKhauMoi2024"}, headers=h)
    assert r.status_code == 200, r.text
    new_h = {"Authorization": f"Bearer {r.json()['access_token']}"}
    # token cũ bị thu hồi, token mới dùng được
    assert client.get("/api/auth/me", headers=h).status_code == 401
    assert client.get("/api/auth/me", headers=new_h).status_code == 200
    assert client.post("/api/auth/login", json={"email": "pw.user@example.com", "password": "MatKhau2024"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "pw.user@example.com", "password": "MatKhauMoi2024"}).status_code == 200
