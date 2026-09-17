"""AI Check: đánh giá dấu hiệu văn bản do AI viết + nhận xét, gợi ý chỉnh sửa — gọi Claude, trả JSON có cấu trúc.

Trung thực về giới hạn: không mô hình nào phát hiện chắc chắn văn bản AI; kết quả là ước lượng để tham khảo,
không dùng làm bằng chứng kỷ luật. Không có ANTHROPIC_API_KEY → enabled() False, endpoint trả 503.
"""
import logging

import anthropic
from fastapi import HTTPException, status
from pydantic import BaseModel, Field

from .config import settings

log = logging.getLogger("learnhub.aicheck")

SYSTEM = """Bạn là công cụ hỗ trợ sinh viên Việt Nam tự rà soát bài viết học thuật (tiểu luận, báo cáo, khoá luận) trước khi nộp.
Nhiệm vụ: đọc văn bản và (1) ước lượng khả năng văn bản được tạo bởi AI, (2) chỉ ra các dấu hiệu cụ thể, (3) nhận xét chất lượng
học thuật, (4) gợi ý chỉnh sửa để bài viết tự nhiên, rõ ràng và mang dấu ấn cá nhân hơn.

Nguyên tắc:
- Việc phát hiện văn bản AI vốn không chắc chắn. Chỉ đưa ai_score cao (>70) khi có nhiều dấu hiệu rõ; confidence phản ánh mức chắc chắn thật.
- Văn bản ngắn (<150 từ) hoặc mang tính công thức (định nghĩa, liệt kê) → confidence "low".
- KHÔNG kết luận đạo văn: bạn không truy cập internet hay kho dữ liệu nào để đối chiếu.
- Trích dẫn đoạn đáng chú ý ngắn (≤ 25 từ), lấy nguyên văn từ bài.
- Viết tiếng Việt, ngắn gọn, cụ thể, có thể hành động. Không dùng markdown."""


class Segment(BaseModel):
    text: str = Field(description="Trích nguyên văn, ≤ 25 từ")
    ai_likelihood: int = Field(ge=0, le=100)
    reason: str


class AiCheckResult(BaseModel):
    ai_score: int = Field(ge=0, le=100, description="Khả năng văn bản do AI viết (%)")
    confidence: str = Field(description="low | medium | high")
    verdict: str = Field(description="Một câu kết luận")
    signals: list[str] = Field(description="Dấu hiệu quan sát được (tối đa 6)")
    segments: list[Segment] = Field(description="Đoạn đáng chú ý nhất (tối đa 5)")
    suggestions: list[str] = Field(description="Gợi ý chỉnh sửa cụ thể (3–6 mục)")
    writing_feedback: str = Field(description="Nhận xét ngắn về chất lượng học thuật: lập luận, dẫn chứng, cấu trúc")


def enabled() -> bool:
    return bool(settings.anthropic_api_key)


def analyze(text: str) -> AiCheckResult:
    if not enabled():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI Check chưa được cấu hình trên hệ thống (thiếu ANTHROPIC_API_KEY)")
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=120.0, max_retries=1)
    words = len(text.split())
    try:
        response = client.beta.messages.parse(
            model=settings.ai_check_model,
            max_tokens=8000,
            system=SYSTEM,
            messages=[{"role": "user", "content": f"Văn bản cần kiểm tra ({words} từ):\n\n{text}"}],
            output_format=AiCheckResult,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError:
        log.error("ANTHROPIC_API_KEY không hợp lệ")
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "AI Check chưa được cấu hình đúng (API key không hợp lệ)")
    except anthropic.RateLimitError:
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Hệ thống đang bận, thử lại sau một phút")
    except anthropic.APIStatusError as e:
        log.error("Claude API %s: %s", e.status_code, e.message)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Dịch vụ phân tích tạm thời gặp lỗi, thử lại sau")
    except anthropic.APIConnectionError as e:
        log.error("Không kết nối được Claude API: %s", e)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Không kết nối được dịch vụ phân tích, thử lại sau")
    if response.stop_reason == "refusal":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nội dung này không thể phân tích. Hãy thử đoạn văn khác")
    result = response.parsed_output
    if result is None:
        log.error("Claude không trả JSON hợp lệ (stop_reason=%s)", response.stop_reason)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "Không đọc được kết quả phân tích, thử lại sau")
    result.signals, result.segments, result.suggestions = result.signals[:6], result.segments[:5], result.suggestions[:6]
    if result.confidence not in ("low", "medium", "high"):
        result.confidence = "low"
    return result
