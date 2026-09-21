"""Chứng nhận: chỉ cấp khi 100%, idempotent, xác thực công khai, mất hiệu lực khi tài khoản xoá."""
from tests.test_api import verify


def _user(client, email):
    r = client.post("/api/auth/register", json={"email": email, "full_name": "Trần Thị Chứng Nhận", "password": "MatKhau2024"})
    verify(client, r.json()["access_token"], email)
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_certificate_flow(client):
    h = _user(client, "cert@example.com")
    free = next(c for c in client.get("/api/courses").json() if c["price"] == 0)
    slug = free["slug"]
    url = f"/api/courses/{slug}/certificate"
    assert client.post(url).status_code == 401
    assert client.post(url, headers=h).status_code == 403  # chưa ghi danh
    client.post(f"/api/courses/{slug}/enroll", headers=h)
    r = client.post(url, headers=h)
    assert r.status_code == 400 and "hoàn thành" in r.json()["detail"]

    total = len(client.get(f"/api/courses/{slug}").json()["lessons"])
    for i in range(total):
        client.put(f"/api/courses/{slug}/lessons/{i}/complete", headers=h)
    r = client.post(url, headers=h)
    assert r.status_code == 200, r.text
    c = r.json()
    assert c["code"].startswith("LH-CERT-") and len(c["code"]) == 16 and c["holder_name"] == "Trần Thị Chứng Nhận"
    assert c["course_title"] == free["title"] and c["lessons"] == total and c["valid"] is True and c["code"] in c["verify_url"]
    assert client.post(url, headers=h).json()["code"] == c["code"]  # idempotent
    assert [x["code"] for x in client.get("/api/certificates/me", headers=h).json()] == [c["code"]]

    # xác thực công khai, không phân biệt hoa thường
    v = client.get(f"/api/certificates/{c['code'].lower()}")
    assert v.status_code == 200 and v.json()["holder_name"] == "Trần Thị Chứng Nhận" and v.json()["valid"] is True
    assert client.get("/api/certificates/LH-CERT-KHONGCO1").status_code == 404
    # tên trên chứng nhận là tên lúc cấp
    client.patch("/api/auth/me", json={"full_name": "Tên Mới"}, headers=h)
    assert client.get(f"/api/certificates/{c['code']}").json()["holder_name"] == "Trần Thị Chứng Nhận"
    # xuất dữ liệu có chứng nhận; xoá tài khoản → chứng nhận bị xoá
    assert client.get("/api/account/export", headers=h).json()["certificates"][0]["code"] == c["code"]
    client.request("DELETE", "/api/account", json={"confirm": "cert@example.com", "password": "MatKhau2024"}, headers=h)
    assert client.get(f"/api/certificates/{c['code']}").status_code == 404
