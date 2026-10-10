"""IP khách sau proxy: lấy phần tử cuối X-Forwarded-For (do proxy nối thêm), không tin phần khách tự gửi."""
from types import SimpleNamespace

from app.config import settings
from app.ratelimit import client_ip


def _req(xff: str | None, host: str = "10.0.0.1"):
    headers = {"x-forwarded-for": xff} if xff is not None else {}
    return SimpleNamespace(headers=headers, client=SimpleNamespace(host=host))


def test_untrusted_proxy_ignores_header(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", False)
    assert client_ip(_req("1.2.3.4")) == "10.0.0.1"


def test_trusted_proxy_uses_last_hop(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    assert client_ip(_req("203.0.113.9")) == "203.0.113.9"
    # khách giả header "1.2.3.4", proxy nối IP thật vào cuối → vẫn ra IP thật
    assert client_ip(_req("1.2.3.4, 203.0.113.9")) == "203.0.113.9"
    assert client_ip(_req("a, b , 203.0.113.9 ")) == "203.0.113.9"
    assert client_ip(_req("")) == "10.0.0.1"
    assert client_ip(_req(None)) == "10.0.0.1"


def test_spoofed_header_cannot_rotate_rate_limit_key(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    seen = {client_ip(_req(f"{i}.{i}.{i}.{i}, 203.0.113.9")) for i in range(1, 20)}
    assert seen == {"203.0.113.9"}
