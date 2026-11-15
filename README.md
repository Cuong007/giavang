# Gold Analyzer — V1 UI prototype

## Chạy thử
1. Giải nén thư mục.
2. Mở `index.html` bằng trình duyệt hiện đại có Internet.
3. Thư viện Lightweight Charts được tải từ CDN.

## Hiện có
- Giao diện responsive cho desktop/mobile.
- Biểu đồ nến XAU/USD với dữ liệu DEMO sinh trong trình duyệt.
- Chuyển khung 1m, 3m, 5m, 15m, 30m, 1H, 4H, 1D.
- Crosshair, zoom, kéo biểu đồ, fit/reset.
- Vị trí dành cho indicator và công tắc âm thanh.

## Chưa có
- Chưa kết nối API giá thật / WebSocket.
- Chưa lưu lịch sử vào database.
- Chưa chuyển Pine Script sang JavaScript.
- Công tắc âm thanh hiện chỉ là UI, chưa phát âm thanh.
- Không dùng dữ liệu DEMO cho quyết định giao dịch.

## Bước tiếp theo
Kết nối backend làm nguồn dữ liệu thống nhất, sau đó lưu OHLC 1 phút và tổng hợp các timeframe lớn hơn.
