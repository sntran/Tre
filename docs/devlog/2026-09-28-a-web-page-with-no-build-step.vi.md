# Một trang web không cần bước dựng, không cần engine

*28 tháng 9 năm 2026 · [English](2026-09-28-a-web-page-with-no-build-step.md)*

Phần lớn trò chơi được làm bằng một game engine và một chuỗi công cụ dựng (build). Mười năm nữa, các công cụ đó sẽ đổi nhiều lần, và một dự án cũ thường không dựng lại được nữa. Chúng tôi muốn một trò chơi vẫn mở được từ chính các tệp của nó.

## Điều chúng tôi tìm thấy

- **Những phần khó của Tre là của riêng Tre.** Bộ sinh bài toán, mô hình về điều trẻ đã biết, các kỳ thi và các luật của thế giới đều phải tự viết dù dùng engine nào. Engine không cho sẵn những thứ đó.
- **Engine làm tăng dung lượng tải về,** trong khi thiết bị đầu tiên của Tre là iPad và máy tính xách tay dùng trình duyệt.
- **Trình duyệt ngày nay tự tải được các mô-đun JavaScript mà không cần công cụ** ([MDN, mô-đun](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)), và một import map cho phép trang web dùng một phiên bản cố định của thư viện từ CDN mà không cần bundler ([MDN, import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap)).

## Điều chúng tôi quyết định

- **Mô-đun JavaScript thuần:** không framework, không bundler, không engine, không bước dựng. Thư viện duy nhất là three.js, ở một phiên bản cố định từ CDN, để vẽ thế giới. HTML và CSS vẽ chữ, để chữ Việt có dấu luôn sắc nét và dễ dịch.
- **Một trang tĩnh trên GitHub Pages** chơi được cả khi không có mạng, nhờ service worker.
- **Phần logic không có mã màn hình** (không DOM, không WebGL), để bộ chạy kiểm thử có sẵn của Node kiểm tra được toàn bộ, không cần thư viện kiểm thử. Hiện có hơn 500 bài kiểm thử.
- **Các đường đi của trẻ là dữ liệu.** Mỗi đường mà trẻ có thể đi trong trò chơi là một tệp câu chuyện: điểm bắt đầu, danh sách các bước, và các điều cần kiểm tra. Cùng một tệp chạy trong kiểm thử và trong trình duyệt, nơi một ngón tay hiện ra và chơi. Ở mỗi bước của mỗi câu chuyện, kiểm thử xem xét các luật của thế giới. Một luật là: không chữ nào trong làng hay trong trận có chữ số, dấu phép tính hay dấu hỏi. Đó là quy tắc [toán là việc em làm](2026-09-29-math-is-what-you-do.vi.md), được máy kiểm tra.
- **Mọi chữ nằm trong tệp ngôn ngữ,** theo khóa. Kiểm thử báo lỗi nếu một khóa chỉ có ở một ngôn ngữ.
- **Tài liệu viết bằng tiếng Anh đơn giản** (ASD-STE100 Simplified Technical English): câu ngắn, một từ cho một nghĩa.

Nếu sau này một nhóm khác muốn có bước dựng cho công việc của họ, họ có thể thêm vào. Quy tắc là trò chơi không bao giờ cần bước dựng để chạy.
