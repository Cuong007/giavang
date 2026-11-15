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

## Android APK
- Dự án dùng Capacitor để đóng gói web app thành ứng dụng Android.
- GitHub Actions workflow `Build Gold Analyzer Android APK` tự tạo APK debug và file ZIP mã nguồn mỗi khi cập nhật app hoặc chạy thủ công.
- Tải APK tại tab Actions → chọn lần chạy `Build Gold Analyzer Android APK` → phần Artifacts → `gold-analyzer-android-build`.
- APK debug dùng để cài thử/thẩm định; chưa phải bản phát hành Google Play đã ký.

## Chưa thực hiện
- Chưa tích hợp Pine Script gốc vì chưa có mã Pine Script.
- Chưa có backend/database riêng, đồng bộ đa thiết bị hoặc lưu offline.


## Nến 1 phút và indicator JavaScript
- Khung 1m yêu cầu tối đa 6.000 nến từ API XAUUSD; các khung thời gian còn lại hiện yêu cầu 1.000 nến.
- Ứng dụng không chạy hoặc dịch Pine Script. Hãy chuyển Pine Script sang JavaScript trước, sau đó dán mã JavaScript vào ô **INDICATOR · JAVASCRIPT** trong bảng điều khiển và nhấn **Nạp indicator JS**.
- Mã indicator phải là một biểu thức JavaScript trả về object theo mẫu dưới đây:

```js
({
  name: "Tên indicator",
  create({ chart, LWC, candles, getBars }) {
    const line = chart.addSeries(LWC.LineSeries, {
      color: "#e8b65b", lineWidth: 2, title: "Tên indicator"
    });
    return {
      update(bars) {
        // Tính toán và gọi line.setData([{ time, value }, ...])
      },
      destroy() {
        chart.removeSeries(line);
      }
    };
  }
})
```

- `update(bars)` được gọi sau khi tải lịch sử và mỗi khi giá cập nhật. `bars` là mảng nến tăng dần theo thời gian, mỗi phần tử có `time` (Unix seconds), `open`, `high`, `low`, `close`.
- Indicator đã nạp được lưu trong bộ nhớ trình duyệt trên thiết bị đó. Nút **Gỡ** xóa riêng indicator; **Xóa tất cả** gỡ toàn bộ.
- Chỉ dán JavaScript từ nguồn đáng tin cậy: mã được thực thi trong trang và có thể truy cập dữ liệu/trạng thái của ứng dụng.


## Lịch sử 6.000 nến M1
- GitHub Actions tự làm mới `data/xauusd-1m.json` mỗi 15 phút bằng workflow `Refresh XAUUSD 6000 M1 history`.
- BiQuote hiện chỉ trả khoảng 301 nến M1 trong feed MT5, không hỗ trợ phân trang lịch sử sâu. Yahoo Finance `GC=F` (COMEX Gold Futures) trả trên 6.000 nến M1 trong cửa sổ 7 ngày.
- Để giữ biểu đồ gần với XAUUSD spot, bộ tạo dữ liệu căn chỉnh lịch sử GC=F bằng chênh lệch trung vị so với các nến BiQuote XAUUSD MT5 trùng timestamp, rồi thay các nến trùng bằng nến spot MT5 thực tế.
- Vì vậy 301 nến gần nhất là spot CFD MT5; phần lịch sử sâu là futures proxy đã căn chỉnh. Đây không phải 6.000 nến spot nguyên bản. Basis futures/spot có thể biến động; không dùng như dữ liệu khớp lệnh hoặc kiểm định cần độ chính xác tuyệt đối.
- APK chứa bản cache tại thời điểm build. Web app đọc cache từ `data/xauusd-1m.json`; GitHub Actions cập nhật file định kỳ.
