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


## Kho lưu trữ và kích hoạt indicator JavaScript
- Dán toàn bộ file JavaScript (kể cả IIFE) vào ô **INDICATOR · JAVASCRIPT** rồi nhấn **Lưu mã JS**. Mã mới mặc định chưa kích hoạt.
- Chỉ khi nhấn **Kích hoạt** ứng dụng mới thực thi mã và áp dụng lên biểu đồ. **Tắt** sẽ dừng indicator, gỡ canvas overlay và các series do indicator tạo.
- Hỗ trợ hai kiểu API:
  - API chung: `init(context)`, `update(bar)`; context có `chart`, `candles`, `container`, `timeframe`, `getBars()`, `addSeries()`, `removeSeries()`, `setStatus()`.
  - API biểu đồ VN30 PRO/legacy: `window.FVGIndicator.init({ chart, series, container, rightOffset })`, `update(candles, rawCandles, timeframe)`. Ứng dụng tự truyền chuỗi nến đang xem và dữ liệu M1 gốc (tối đa 6.000 nến trong khung 1m/3m).
- Với API legacy, app tự nhận diện indicator có `config` và `update(candles, rawCandles, timeframe)`; canvas overlay do script thêm vào vùng biểu đồ được giữ khi bật và gỡ khi tắt.
- Trạng thái kích hoạt được lưu trên thiết bị. Indicator đã bật sẽ được kích hoạt lại khi mở app; indicator chưa bật không chạy và không vẽ. Lưu lại mã trùng sẽ cập nhật source và chuyển về chưa kích hoạt.
- **Mở** đưa mã đã lưu vào khung soạn thảo; **Xóa** xóa từng mã; **Xóa toàn bộ kho** xóa tất cả mã.
- Kho lưu bằng localStorage trên thiết bị/trình duyệt hiện tại, không đồng bộ giữa thiết bị. Pine Script không tự chuyển thành JavaScript.
- JavaScript đã kích hoạt có thể thực thi mã tùy ý trong ứng dụng. Chỉ kích hoạt mã từ nguồn đáng tin cậy.

## Lịch sử 6.000 nến M1
- GitHub Actions tự làm mới `data/xauusd-1m.json` mỗi 15 phút bằng workflow `Refresh XAUUSD 6000 M1 history`.
- BiQuote hiện chỉ trả khoảng 301 nến M1 trong feed MT5, không hỗ trợ phân trang lịch sử sâu. Yahoo Finance `GC=F` (COMEX Gold Futures) trả trên 6.000 nến M1 trong cửa sổ 7 ngày.
- Để giữ biểu đồ gần với XAUUSD spot, bộ tạo dữ liệu căn chỉnh lịch sử GC=F bằng chênh lệch trung vị so với các nến BiQuote XAUUSD MT5 trùng timestamp, rồi thay các nến trùng bằng nến spot MT5 thực tế.
- Vì vậy 301 nến gần nhất là spot CFD MT5; phần lịch sử sâu là futures proxy đã căn chỉnh. Đây không phải 6.000 nến spot nguyên bản. Basis futures/spot có thể biến động; không dùng như dữ liệu khớp lệnh hoặc kiểm định cần độ chính xác tuyệt đối.
- APK chứa bản cache tại thời điểm build. Web app đọc cache từ `data/xauusd-1m.json`; GitHub Actions cập nhật file định kỳ.
