# Trò chơi biết trẻ đã biết gì mà không cần bài kiểm tra

*29 tháng 9 năm 2026 · [English](2026-09-29-how-the-game-knows.md)*

Nếu thế giới không có câu hỏi, làm sao trò chơi biết khi nào trẻ đã học được một phép tính? Chúng tôi muốn một mô hình đơn giản, mà một nhóm nhỏ có thể tự tay kiểm tra, và chạy ngay trên thiết bị, không cần máy chủ.

## Điều chúng tôi tìm thấy

- **Thành công gọn gàng mới là tín hiệu.** Trong trò chơi Physics Playground, tín hiệu mạnh là một màn giải xong với ít vật nhất, chứ không phải chỉ giải xong. Tín hiệu đó đáng tin (alpha = 0,87), và ước lượng của trò chơi chỉ khớp một phần với một bài kiểm tra vật lý bên ngoài (r = 0,41) ([Shute & Moore](https://myweb.fsu.edu/vshute/pdf/ShuteMoore.pdf)). Vậy ước lượng kiểu này xếp thứ tự trẻ khá tốt, nhưng không đoán tốt điểm một bài thi trên giấy.
- **Một mô hình đơn giản là đủ.** Bayesian Knowledge Tracing giữ, cho mỗi kỹ năng, khả năng trẻ đã biết kỹ năng đó. Một mô hình bị hỏng nếu khả năng này giảm sau một câu đúng, hoặc nếu mười câu đúng liên tiếp vẫn chưa đạt mức thành thạo ([Baker, Corbett & Aleven 2008](https://learninganalytics.upenn.edu/ryanbaker/BCA2008W.pdf)). Các mô hình học sâu mất phần lớn lợi thế khi mô hình đơn giản cũng tính đến sự quên và năng lực của từng trẻ ([Khajah, Lindsey & Mozer 2016](https://www.educationaldatamining.org/EDM2016/proceedings/paper_144.pdf)).
- **Xếp hạng độ khó cần đông người.** Math Garden xếp hạng cả trẻ lẫn từng câu sau mỗi lần trả lời, nhắm mức đúng 75%, và đã phục vụ hơn 400.000 trẻ em Hà Lan ([Brinkhuis và cộng sự 2018](https://files.eric.ed.gov/fulltext/EJ1187391.pdf)). Hệ thống học độ khó của một câu từ rất nhiều trẻ. Một thiết bị không có máy chủ thì không làm được.
- **Một thứ tự khéo léo tự nó không giúp gì.** Trong một nghiên cứu, thứ tự thích ứng, thứ tự cố định và cho trẻ tự chọn màn đều cho kết quả như nhau; những đoạn phim ngắn giúp nhiều nhất ([Shute và cộng sự 2021](https://eric.ed.gov/?id=EJ1281101)).
- **Bấm bừa thì dễ nhận ra.** Trẻ lách hệ thống học được ít hơn, và dấu hiệu là thời gian rất ngắn, xem gợi ý thật nhanh, và đoán mò ([Aleven và cộng sự 2016](https://www.cs.cmu.edu/~aleven/Papers/2016/Aleven_etal_IJAIED2016-Helpseeking.pdf)).

## Điều chúng tôi quyết định

- **Mỗi hành động trong thế giới là một bằng chứng.** "Giải xong với ít phần nhất ngay lần đầu" có trọng số lớn nhất.
- **Mô hình đơn giản, đặt tay** trong giới hạn chuẩn, có tính sự quên. Chúng tôi không khớp mô hình từ dữ liệu, vì không có đông người.
- **Xếp hạng chỉ thay đổi cho trẻ.** Độ khó của nhiệm vụ đến từ thiết kế: độ dài khoảng trống, số loại kích cỡ, cỡ của một nhóm.
- **Ôn tập đến từ sự quên.** Khi một kỹ năng đến hạn, nhiệm vụ tiếp theo trong thế giới cần đến nó. Không có màn hình ôn tập. Các khoảng cách (1, 3, 7, 14 và 30 ngày) là một quy ước; chúng tôi không tìm thấy bằng chứng cho đúng những con số này.
- **Bấm bừa không phải là bằng chứng, cũng không phải là lỗi.** Nhiệm vụ trở nên đơn giản hơn, hoặc một người làm mẫu.
- **Không có điểm "trình độ lớp" cho cha mẹ,** vì ước lượng không đoán đủ tốt điểm một bài thi trên giấy.
- **Công sức của chúng tôi dồn vào các quy tắc đọc bằng chứng và hình ảnh của thế giới,** không dồn vào một thuật toán khéo léo.
