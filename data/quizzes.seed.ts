// Bộ đề trắc nghiệm MẪU — CHỈ dùng cho script seed (scripts/export-courses.mts → backend/app/seed_data.json).
// KHÔNG import vào app/ hay components/: file chứa đáp án, không được nằm trong bundle công khai.
// Cấu trúc: slug → { chỉ_số_bài: Quiz }. Sau khi DB đã có dữ liệu, sửa đề qua trang admin (khối "Trắc nghiệm theo bài").
export type SeedQuiz = { pass_percent: number; questions: { q: string; options: string[]; answer: number; explain?: string }[] };

const Q = (q: string, options: string[], answer: number, explain = "") => ({ q, options, answer, explain });

export const lessonQuizzes: Record<string, Record<number, SeedQuiz>> = {
  "trac-nghiem-triet-hoc-mac-lenin": {
    0: { pass_percent: 70, questions: [
      Q("Triết học Mác – Lênin ra đời vào khoảng thời gian nào?", ["Đầu thế kỷ XVIII", "Những năm 40 của thế kỷ XIX", "Đầu thế kỷ XX", "Sau Cách mạng Tháng Mười 1917"], 1, "Gắn với hoạt động lý luận của C. Mác và Ph. Ăngghen từ những năm 1840."),
      Q("Vấn đề cơ bản của triết học là mối quan hệ giữa:", ["Con người và tự nhiên", "Vật chất và ý thức", "Lý luận và thực tiễn", "Cá nhân và xã hội"], 1, "Ph. Ăngghen: vấn đề cơ bản lớn của mọi triết học là quan hệ giữa tư duy và tồn tại."),
      Q("Theo Lênin, vật chất là:", ["Tổng hợp các nguyên tử", "Phạm trù triết học chỉ thực tại khách quan được cảm giác phản ánh", "Những gì con người nhìn thấy được", "Năng lượng của vũ trụ"], 1, "Định nghĩa trong tác phẩm 'Chủ nghĩa duy vật và chủ nghĩa kinh nghiệm phê phán'."),
      Q("Phương thức tồn tại của vật chất là:", ["Không gian", "Thời gian", "Vận động", "Ý thức"], 2, "Vận động là phương thức tồn tại; không gian, thời gian là hình thức tồn tại của vật chất."),
      Q("Quy luật nào được coi là 'hạt nhân' của phép biện chứng duy vật?", ["Lượng – chất", "Phủ định của phủ định", "Thống nhất và đấu tranh của các mặt đối lập", "Quan hệ nhân – quả"], 2, "Quy luật mâu thuẫn chỉ ra nguồn gốc, động lực của sự vận động, phát triển."),
    ]},
    1: { pass_percent: 70, questions: [
      Q("Nguồn gốc xã hội trực tiếp quyết định sự ra đời của ý thức là:", ["Bộ óc người", "Lao động và ngôn ngữ", "Thế giới khách quan", "Giáo dục"], 1),
      Q("Theo quan điểm duy vật biện chứng, thực tiễn là:", ["Hoạt động tinh thần của con người", "Hoạt động vật chất có mục đích, mang tính lịch sử – xã hội", "Toàn bộ hoạt động của con người", "Kinh nghiệm cá nhân"], 1),
      Q("Trong lực lượng sản xuất, yếu tố giữ vai trò quyết định là:", ["Công cụ lao động", "Đối tượng lao động", "Người lao động", "Khoa học – công nghệ"], 2, "Người lao động là chủ thể sáng tạo và sử dụng công cụ."),
      Q("Quy luật xã hội cơ bản nhất chi phối sự vận động của các hình thái kinh tế – xã hội là:", ["Quy luật đấu tranh giai cấp", "Quy luật quan hệ sản xuất phù hợp với trình độ phát triển của lực lượng sản xuất", "Quy luật cạnh tranh", "Quy luật giá trị"], 1),
      Q("Cơ sở hạ tầng của một xã hội là:", ["Hệ thống giao thông, điện, nước", "Toàn bộ quan hệ sản xuất hợp thành cơ cấu kinh tế", "Nhà nước và pháp luật", "Khoa học và giáo dục"], 1, "Không nhầm với 'cơ sở hạ tầng kỹ thuật' trong đời sống thường ngày."),
    ]},
  },
  "trac-nghiem-kinh-te-chinh-tri": {
    0: { pass_percent: 70, questions: [
      Q("Hàng hóa có hai thuộc tính là:", ["Giá cả và giá trị", "Giá trị sử dụng và giá trị", "Chất lượng và số lượng", "Cung và cầu"], 1),
      Q("Lượng giá trị của hàng hóa được đo bằng:", ["Thời gian lao động cá biệt", "Thời gian lao động xã hội cần thiết", "Giá bán trên thị trường", "Chi phí nguyên liệu"], 1),
      Q("Tiền tệ có mấy chức năng cơ bản?", ["3", "4", "5", "6"], 2, "Thước đo giá trị, phương tiện lưu thông, cất trữ, thanh toán, tiền tệ thế giới."),
      Q("Nguồn gốc của giá trị thặng dư là:", ["Lưu thông hàng hóa", "Lao động không được trả công của công nhân", "Máy móc", "Tài năng của nhà tư bản"], 1),
      Q("Tư bản bất biến (c) là bộ phận tư bản:", ["Mua sức lao động", "Mua tư liệu sản xuất, giá trị không đổi trong quá trình sản xuất", "Nộp thuế", "Dùng để mở rộng sản xuất"], 1),
    ]},
  },
  "trac-nghiem-tu-tuong-ho-chi-minh": {
    0: { pass_percent: 70, questions: [
      Q("Nguyễn Tất Thành ra đi tìm đường cứu nước năm nào?", ["1905", "1911", "1920", "1930"], 1, "Ngày 5/6/1911 tại bến Nhà Rồng."),
      Q("Sự kiện đánh dấu Nguyễn Ái Quốc trở thành người cộng sản Việt Nam đầu tiên:", ["Gửi Yêu sách của nhân dân An Nam (1919)", "Bỏ phiếu tán thành Quốc tế III, tham gia sáng lập Đảng Cộng sản Pháp (1920)", "Thành lập Hội Việt Nam Cách mạng Thanh niên (1925)", "Chủ trì Hội nghị hợp nhất (1930)"], 1),
      Q("Cơ sở lý luận quyết định bản chất tư tưởng Hồ Chí Minh là:", ["Tinh hoa văn hóa phương Đông", "Chủ nghĩa Mác – Lênin", "Tư tưởng dân chủ tư sản", "Giá trị truyền thống dân tộc"], 1),
      Q("Theo Hồ Chí Minh, đạo đức cách mạng có vai trò:", ["Là mục tiêu cuối cùng", "Là gốc, là nền tảng của người cách mạng", "Là điều kiện đủ để thành công", "Thay thế cho tài năng"], 1, "'Cũng như sông thì có nguồn mới có nước... người cách mạng phải có đạo đức'."),
      Q("Tác phẩm 'Đường Kách mệnh' được xuất bản năm:", ["1925", "1927", "1930", "1941"], 1),
    ]},
  },
  "trac-nghiem-lich-su-dang": {
    0: { pass_percent: 70, questions: [
      Q("Đảng Cộng sản Việt Nam được thành lập ngày:", ["3/2/1930", "19/8/1945", "2/9/1945", "7/5/1954"], 0),
      Q("Hội nghị hợp nhất các tổ chức cộng sản đầu năm 1930 diễn ra tại:", ["Hà Nội", "Quảng Châu", "Hương Cảng (Hồng Kông)", "Pác Bó"], 2),
      Q("Cương lĩnh chính trị đầu tiên của Đảng do ai soạn thảo?", ["Trần Phú", "Nguyễn Ái Quốc", "Lê Hồng Phong", "Hà Huy Tập"], 1, "Trần Phú soạn Luận cương chính trị tháng 10/1930."),
      Q("Cách mạng Tháng Tám thành công, nước Việt Nam Dân chủ Cộng hòa ra đời ngày:", ["19/8/1945", "23/8/1945", "2/9/1945", "6/1/1946"], 2),
      Q("Đại hội nào của Đảng đề ra đường lối đổi mới toàn diện đất nước?", ["Đại hội IV (1976)", "Đại hội V (1982)", "Đại hội VI (1986)", "Đại hội VII (1991)"], 2),
    ]},
  },
  "trac-nghiem-mang-may-tinh": {
    0: { pass_percent: 70, questions: [
      Q("Mô hình OSI có bao nhiêu tầng?", ["4", "5", "7", "8"], 2),
      Q("Giao thức nào hoạt động ở tầng vận chuyển (Transport) và đảm bảo truyền tin cậy?", ["IP", "UDP", "TCP", "ARP"], 2, "TCP có bắt tay 3 bước, đánh số thứ tự và xác nhận; UDP không tin cậy."),
      Q("Địa chỉ IPv4 có độ dài:", ["16 bit", "32 bit", "64 bit", "128 bit"], 1),
      Q("Mạng 192.168.1.0/26 có bao nhiêu địa chỉ host sử dụng được?", ["30", "62", "64", "126"], 1, "2^(32−26) = 64 địa chỉ, trừ địa chỉ mạng và broadcast còn 62."),
      Q("Thiết bị nào chuyển tiếp gói tin dựa trên địa chỉ MAC?", ["Router", "Switch", "Hub", "Modem"], 1),
    ]},
  },
  "trac-nghiem-co-so-du-lieu": {
    0: { pass_percent: 70, questions: [
      Q("Khóa chính (primary key) có đặc điểm:", ["Có thể trùng lặp", "Có thể NULL", "Duy nhất và không NULL", "Chỉ là số nguyên"], 2),
      Q("Câu lệnh SQL nào dùng để lấy dữ liệu?", ["INSERT", "SELECT", "UPDATE", "ALTER"], 1),
      Q("Một quan hệ đạt dạng chuẩn 1NF khi:", ["Không có phụ thuộc bắc cầu", "Mọi thuộc tính đều nguyên tố (không đa trị, không lặp)", "Mọi thuộc tính không khóa phụ thuộc đầy đủ vào khóa", "Có đúng một khóa"], 1),
      Q("Phép JOIN nào trả về mọi dòng của bảng trái kể cả khi không khớp?", ["INNER JOIN", "LEFT JOIN", "CROSS JOIN", "SELF JOIN"], 1),
      Q("ACID trong giao dịch, chữ 'I' nghĩa là:", ["Integrity", "Isolation", "Index", "Identity"], 1, "Atomicity, Consistency, Isolation, Durability."),
    ]},
  },
  "trac-nghiem-tieng-anh-b1": {
    0: { pass_percent: 70, questions: [
      Q("She ___ to the gym every morning.", ["go", "goes", "is going", "gone"], 1, "Thói quen ở hiện tại → hiện tại đơn, chủ ngữ ngôi thứ ba số ít thêm -es."),
      Q("I have lived here ___ 2015.", ["for", "since", "during", "from"], 1, "since + mốc thời gian; for + khoảng thời gian."),
      Q("If it rains tomorrow, we ___ at home.", ["stay", "stayed", "will stay", "would stay"], 2, "Câu điều kiện loại 1."),
      Q("Choose the word with a different stress pattern:", ["'teacher", "'happy", "be'gin", "'water"], 2),
      Q("The film was so boring that I ___ asleep.", ["fell", "felt", "feel", "fallen"], 0),
    ]},
  },
  "trac-nghiem-he-dieu-hanh": {
    0: { pass_percent: 70, questions: [
      Q("Thành phần nào của hệ điều hành trực tiếp quản lý phần cứng?", ["Shell", "Kernel", "Trình biên dịch", "Trình duyệt"], 1),
      Q("Tiến trình (process) khác luồng (thread) ở điểm:", ["Tiến trình có không gian địa chỉ riêng, các luồng trong cùng tiến trình chia sẻ không gian đó", "Luồng chạy nhanh hơn vì có RAM riêng", "Tiến trình không thể chạy song song", "Không có khác biệt"], 0),
      Q("Deadlock xảy ra khi thỏa đồng thời mấy điều kiện cần (Coffman)?", ["2", "3", "4", "5"], 2, "Loại trừ tương hỗ, giữ và chờ, không ưu tiên, chờ vòng."),
      Q("Thuật giải điều phối CPU nào có thể gây 'đói' (starvation) cho tiến trình dài?", ["FCFS", "Round Robin", "SJF (Shortest Job First)", "Không thuật giải nào"], 2),
      Q("Bộ nhớ ảo (virtual memory) cho phép:", ["Chạy chương trình lớn hơn RAM vật lý", "Tăng tốc CPU", "Không cần đĩa cứng", "Loại bỏ hoàn toàn lỗi trang"], 0),
    ]},
  },
};
