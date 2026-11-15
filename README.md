# Gold Analyzer — Web V2

## Chạy thử
Mở `index.html` bằng Chrome/Edge khi có Internet. Thư viện biểu đồ và SignalR được tải từ CDN.

## Tính năng
- Giữ giao diện dark responsive của bản V1.
- Biểu đồ nến XAU/USD lấy OHLC từ API.
- Khung 1m, 3m, 5m, 15m, 30m, 1H, 4H, 1D. Khung 3m được tổng hợp từ nến 1m.
- Giá mới nhất nhận qua SignalR hub; nếu SignalR không kết nối được thì tự chuyển sang REST polling.
- Đồng bộ lại lịch sử nến mỗi 60 giây; hiển thị OHLC trên biểu đồ.
- Công tắc âm thanh phát tiếng thử và cảnh báo khi giá dịch chuyển ít nhất 1 USD so với tick trước.

## Nguồn và giới hạn dữ liệu
- Nhà cung cấp: [biquote API](https://biquote.io/docs/), REST base `https://biquote.io/api`, SignalR `https://biquote.io/hubs/tick`.
- Dữ liệu XAUUSD được mô tả là feed MetaTrader 5 (MT5), loại Forex/Metals/CFD. **Không phải dữ liệu hợp đồng ICE/CME hoặc giá giao dịch tập trung.**
- API ghi rõ volume và last của nguồn FX/CFD có thể bằng 0; ứng dụng không diễn giải volume này là khối lượng giao dịch sàn.
- Nguồn công khai không cần API key theo tài liệu tại thời điểm tích hợp; dịch vụ có thể thay đổi/gián đoạn.
- Không dùng dữ liệu này làm căn cứ giao dịch nếu chưa đối chiếu với broker của bạn.

## Chưa thực hiện
- Chưa tích hợp Pine Script gốc vì chưa có mã Pine Script.
- Chưa có backend/database riêng, đồng bộ đa thiết bị hoặc lưu offline.
- Chưa đóng gói Android APK; đây hiện là web app chạy trong trình duyệt.
