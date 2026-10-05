# Mỗi thứ chỉ có một dáng vẻ, và những nhân vật xoay được bằng tay

*2 tháng 10 năm 2026 · [English](2026-10-02-one-look-for-each-thing.md)*

Một trò chơi có nhiều hình ảnh của cùng một thứ: nhân vật trong thế giới, khuôn mặt khi nói chuyện, nhân vật trên màn hình trẻ tạo ra nó, bức tranh trong sổ tay, và các trang tham khảo cho người làm game. Nếu mỗi thứ được vẽ riêng, chúng sẽ dần khác nhau.

## Điều chúng tôi tìm thấy

- **Hai dáng vẻ cho một người sẽ dần khác nhau.** Trong những bản dựng đầu, mọi hình vẽ đều là tranh vẽ (SVG), kể cả khuôn mặt khi nói chuyện và nhân vật ở màn hình tạo nhân vật. Rồi thế giới khối vuông mang thêm một dáng vẻ thứ hai cho mỗi người. Có hai dáng vẻ thì mỗi thay đổi phải làm hai lần, và rất dễ quên một lần.
- **Trang tham khảo vẽ tay sẽ tụt lại sau mã.** Chủ dự án muốn các trang tham khảo hiện chính nhân vật trong trò chơi, luôn mới nhất, và mỗi nhân vật đứng riêng trên một đế, như một quân cờ, để có thể tự tay xoay.

Chúng tôi không tìm thấy nghiên cứu nào cho việc này. Đây là một lựa chọn thực tế, và chúng tôi nói rõ ở đây.

## Điều chúng tôi quyết định

- **Mỗi thứ chỉ có một dáng vẻ.** Mọi thứ trong thế giới, và mọi hình ảnh của nó trên màn hình, đều sinh ra từ cùng một mã: khuôn mặt khi nói chuyện, nhân vật ở màn hình tạo nhân vật, thẻ các nghề và tranh trong sổ tay đều được vẽ từ nhân vật khối vuông, với nét mặt theo tâm trạng khi cần. Tranh vẽ chỉ còn cho các biểu tượng nhỏ, logo, giấy và hoa văn khung.
- **Trang tham khảo nhân vật là một bàn cờ** ([nhân vật](https://sntran.github.io/Tre/docs/reference/figures.html)). Mỗi nhân vật đứng trên một đế gỗ tròn, trên một ô giấy dó. Chạm để nhấc một quân lên; kéo để xoay trọn một vòng. Các công tắc cho thấy nhân vật bước đi, trong gió, với từng tâm trạng, ban đêm, ở xa, và từ góc máy quay của trò chơi.
- **Mỗi góc nhìn có địa chỉ riêng,** ví dụ `figures.html?look=grandma&mood=happy`, để một ghi chú có thể dẫn đến một nhân vật thay cho ảnh chụp màn hình.
- **Không còn trang tham khảo vẽ tay nào phải cập nhật.** Một nhân vật mới trong dữ liệu tự hiện lên bàn cờ mà không cần sửa trang.
