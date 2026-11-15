# Gold Analyzer — Web V2

## Chạy thử và kết nối OANDA
1. Mở ứng dụng, nhấn OANDA API ở góc trên.
2. Nhập Account ID và Personal Access Token của tài khoản OANDA v20.
3. Chọn OK cho tài khoản Practice/Demo; chọn Cancel cho tài khoản Live.
4. Ứng dụng tải tối đa 5.000 nến XAU_USD khung M1 bằng OANDA REST và sau đó mở Pricing Stream để cập nhật giá BID liên tục.
5. Các khung 3m, 5m, 15m, 30m, 1H, 4H, 1D được tổng hợp từ M1.

Lưu ý bảo mật: Token được nhập trên thiết bị và chỉ giữ trong bộ nhớ phiên; đóng/mở lại ứng dụng sẽ cần nhập lại. Không gửi token qua chat, không commit vào GitHub và không chia sẻ APK có token. Nếu token bị lộ, hãy thu hồi trong OANDA Account Management. Ứng dụng kết nối trực tiếp tới OANDA; nếu OANDA chặn CORS trên WebView hoặc tài khoản không có XAU_USD, cần thêm backend proxy an toàn.

## Nguồn dữ liệu và giới hạn
- Nhà cung cấp duy nhất: OANDA v20, instrument XAU_USD, giá BID.
- Lịch sử: endpoint candles với granularity=M1, count=5000, price=B.
- Realtime: endpoint Pricing Stream; OANDA có thể gửi tối đa 4 thông điệp giá/giây/instrument, không phải toàn bộ tick exchange.
- Đây là giá spot/CFD theo thanh khoản và nhóm giá của tài khoản OANDA, không phải giá hợp đồng vàng ICE/CME.
- Tài khoản demo/practice miễn phí tùy khu vực và pháp nhân OANDA; cần xác minh tài khoản có instrument XAU_USD và quyền API v20.
- Không có dữ liệu khi chưa cấu hình thông tin xác thực. Không hiển thị giá giả hoặc dùng cache nhà cung cấp khác làm dự phòng.
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

## Chart navigation, OHLC and fullscreen
- OHLC panel follows the candle under the crosshair; when the crosshair leaves the plot it returns to the latest candle.
- Scheduled data refresh preserves the visible time range. The chart does not jump to the right edge; use **Đặt lại** when you want to fit the chart again.
- **Toàn màn hình / Thu lại** toggles fullscreen for the chart panel.

## Indicator-based sound alerts
Only activated indicators are listed in the alert configuration. The master sound switch enables/disables playback; each declared event has its own enable checkbox and sound selection.
- Choose an MP3/WAV/M4A/OGG file from device storage. The selected audio is stored locally in IndexedDB on that device (up to 15 MB); it is not uploaded to GitHub.
- Each indicator must explicitly declare event definitions and emit the event when its condition occurs. The app does not guess signal logic by searching arbitrary JavaScript text.
- For a generic indicator, use the context API:
```js
const api = {
  init(context) {
    context.alerts.define([
      { id: "fvg.created", label: "FVG mới hình thành", description: "Khi xuất hiện vùng FVG" },
      { id: "ema.cross", label: "EMA cắt nhau" }
    ]);
    this.context = context;
  },
  update(bar) {
    // Call only when the actual condition is detected:
    // this.context.alerts.emit("fvg.created", { message: "Bullish FVG" });
  },
  reset() {}
};
window.MyIndicator = api;
```
- For existing object-style/legacy indicators such as `window.FVGIndicator`, expose `api.alerts = [{ id, label, description }]` and call `api.alert("fvg.created", { message: "..." })` at the exact signal point.
- Alerts are opt-in per event and rate-limited to one repeat per event every 15 seconds. Browser/Android audio playback must first be unlocked by the user using the sound switch.
