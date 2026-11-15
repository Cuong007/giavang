/* Gold Analyzer Web V2 — XAUUSD public MT5/CFD feed */
(() => {
  "use strict";
  const API = "https://biquote.io/api";
  const chartEl = document.getElementById("chart");
  const chart = LightweightCharts.createChart(chartEl, {
    width: chartEl.clientWidth, height: chartEl.clientHeight,
    layout: { background: { type: "solid", color: "#111821" }, textColor: "#8292a5", fontFamily: "Inter, system-ui, sans-serif" },
    grid: { vertLines: { color: "#1d2935" }, horzLines: { color: "#1d2935" } },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal, vertLine: { color: "#7e8fa3", labelBackgroundColor: "#344354" }, horzLine: { color: "#7e8fa3", labelBackgroundColor: "#344354" } },
    rightPriceScale: { borderColor: "#293746", scaleMargins: { top: .12, bottom: .12 } },
    timeScale: { borderColor: "#293746", timeVisible: true, secondsVisible: false },
    handleScroll: { mouseWheel: true, pressedMouseMove: true }, handleScale: { mouseWheel: true, pinch: true }
  });
  const candles = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: "#19b985", downColor: "#ed5c68", borderUpColor: "#19b985", borderDownColor: "#ed5c68", wickUpColor: "#19b985", wickDownColor: "#ed5c68"
  });
  const fmt = n => Number.isFinite(Number(n)) ? Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";
  const tfSeconds = { "1m":60, "3m":180, "5m":300, "15m":900, "30m":1800, "1H":3600, "4H":14400, "1D":86400 };
  const apiIntervals = { "1m":"1m", "5m":"5m", "15m":"15m", "30m":"30m", "1H":"1h", "4H":"4h", "1D":"1d" };
  const tfNames = { "1m":"1 phút", "3m":"3 phút", "5m":"5 phút", "15m":"15 phút", "30m":"30 phút", "1H":"1 giờ", "4H":"4 giờ", "1D":"1 ngày" };
  let current = "1m", bars = [], busy = false, hub = null, soundEnabled = false, audioCtx = null, lastAlertPrice = null;
  const el = id => document.getElementById(id);
  function setStatus(text, good) {
    el("connectionText").textContent = text;
    const dot = document.querySelector(".dot");
    dot.style.background = good ? "#19c78a" : "#e5a83d";
    dot.style.boxShadow = good ? "0 0 10px #19c78a77" : "0 0 10px #e5a83d77";
  }
  function updateBar(bar) {
    if (!bar) return;
    el("lastPrice").textContent = fmt(bar.close);
    const pct = (bar.close - bar.open) / bar.open * 100;
    el("priceChange").textContent = (pct >= 0 ? "+" : "") + pct.toFixed(2) + "% " + (pct >= 0 ? "▲" : "▼");
    el("priceChange").style.color = pct >= 0 ? "var(--green)" : "var(--red)";
    el("ohlc").textContent = `O ${fmt(bar.open)}　H ${fmt(bar.high)}　L ${fmt(bar.low)}　C ${fmt(bar.close)}`;
    el("sOpen").textContent = fmt(bar.open);
    el("sHigh").textContent = fmt(bar.high);
    el("sLow").textContent = fmt(bar.low);
    el("sPrev").textContent = bars.length > 1 ? fmt(bars[bars.length - 2].close) : "—";
  }
  function toBars(raw) {
    return raw.map(b => ({
      time: Math.floor(new Date(b.openTime).getTime() / 1000),
      open: Number(b.open), high: Number(b.high), low: Number(b.low), close: Number(b.close),
      volume: Number(b.tickVolume || b.volume || 0), isOpen: Boolean(b.isOpen)
    })).filter(b => Number.isFinite(b.time) && [b.open,b.high,b.low,b.close].every(Number.isFinite)).sort((a,b) => a.time-b.time);
  }
  function aggregate3m(input) {
    const map = new Map();
    for (const b of input) {
      const time = Math.floor(b.time / 180) * 180;
      const prev = map.get(time);
      if (!prev) map.set(time, { ...b, time });
      else { prev.high = Math.max(prev.high,b.high); prev.low = Math.min(prev.low,b.low); prev.close = b.close; prev.volume += b.volume; prev.isOpen = b.isOpen; }
    }
    return [...map.values()];
  }
  async function loadCandles() {
    if (busy) return;
    busy = true;
    try {
      const sourceTf = current === "3m" ? "1m" : apiIntervals[current];
      const url = `${API}/XAUUSD/ohlc?interval=${sourceTf}&limit=1000`;
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("OHLC HTTP " + response.status);
      const json = await response.json();
      if (!Array.isArray(json.bars) || !json.bars.length) throw new Error("API chưa trả về nến XAUUSD");
      let data = toBars(json.bars);
      if (current === "3m") data = aggregate3m(data);
      bars = data;
      candles.setData(data.map(({time,open,high,low,close}) => ({time,open,high,low,close})));
      chart.timeScale().fitContent();
      el("chartTfLabel").textContent = "· " + tfNames[current];
      el("barCount").textContent = data.length + " nến · dữ liệu API";
      updateBar(data[data.length - 1]);
      setStatus("Đã nhận dữ liệu XAUUSD", true);
    } catch (err) {
      setStatus("Lỗi tải nến: " + err.message, false);
      console.error(err);
    } finally { busy = false; }
  }
  function updateQuote(q) {
    const mid = Number(q.mid);
    if (!Number.isFinite(mid)) return;
    el("lastPrice").textContent = fmt(mid);
    const pct = Number(q.dayDiffPercent);
    el("priceChange").textContent = Number.isFinite(pct) && !q.stale ? (pct >= 0 ? "+" : "") + pct.toFixed(2) + "% " + (pct >= 0 ? "▲" : "▼") : (q.stale ? "GIÁ GẦN NHẤT" : "—");
    el("priceChange").style.color = pct >= 0 ? "var(--green)" : "var(--red)";
    el("sHigh").textContent = fmt(q.high);
    el("sLow").textContent = fmt(q.low);
    el("sOpen").textContent = Number.isFinite(Number(q.open)) ? fmt(q.open) : "—";
    el("sPrev").textContent = "—";
    const age = Number(q.quoteAgeSeconds);
    setStatus(q.marketState === "closed" || q.stale ? "Thị trường đóng · giá cũ" : "LIVE · MT5 feed" + (Number.isFinite(age) ? " · " + age + "s" : ""), q.marketState !== "closed" && !q.stale);
    patchQuote(mid, q.timestamp);
    if (soundEnabled && lastAlertPrice !== null && Math.abs(mid - lastAlertPrice) >= 1) beep();
    lastAlertPrice = mid;
  }
  function patchQuote(price, timestamp) {
    if (!bars.length) return;
    const stamp = timestamp ? Math.floor(new Date(timestamp).getTime()/1000) : Math.floor(Date.now()/1000);
    const duration = tfSeconds[current], bucket = Math.floor(stamp/duration)*duration;
    const last = bars[bars.length-1];
    if (bucket < last.time) return;
    if (bucket === last.time) { last.high=Math.max(last.high,price); last.low=Math.min(last.low,price); last.close=price; }
    else { bars.push({time:bucket,open:last.close,high:Math.max(last.close,price),low:Math.min(last.close,price),close:price}); if (bars.length>1200) bars.shift(); }
    const b=bars[bars.length-1];
    candles.update({time:b.time,open:b.open,high:b.high,low:b.low,close:b.close});
    updateBar(b);
  }
  async function fetchQuote() {
    try {
      const r = await fetch(API + "/XAUUSD?allowStale=true", {cache:"no-store"});
      if (!r.ok) throw new Error("Quote HTTP " + r.status);
      updateQuote(await r.json());
    } catch(e) { setStatus("Không lấy được giá: " + e.message, false); console.error(e); }
  }
  async function connectSignalR() {
    try {
      await new Promise((resolve,reject) => {
        if (window.signalR) return resolve();
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js";
        s.onload=resolve; s.onerror=reject; document.head.appendChild(s);
      });
      hub = new signalR.HubConnectionBuilder().withUrl("https://biquote.io/hubs/tick").withAutomaticReconnect().build();
      hub.on("ReceiveTick", tick => { if (tick && tick.symbol === "XAUUSD") updateQuote(tick); });
      await hub.start();
      await hub.invoke("Subscribe", ["XAUUSD"]);
      setStatus("LIVE · SignalR MT5", true);
    } catch(e) {
      console.warn("SignalR unavailable; using REST fallback",e);
      setStatus("REST fallback · MT5", false);
      fetchQuote();
      setInterval(fetchQuote, 10000);
    }
  }
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const osc=audioCtx.createOscillator(), gain=audioCtx.createGain();
      osc.frequency.value=880; gain.gain.value=.06;
      osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime+.12);
    } catch(e) { console.warn("Audio unavailable",e); }
  }
  document.getElementById("timeframes").addEventListener("click", e => {
    const btn=e.target.closest("[data-tf]"); if(!btn || btn.dataset.tf===current) return;
    current=btn.dataset.tf;
    document.querySelectorAll(".tf").forEach(b=>b.classList.toggle("active",b===btn));
    loadCandles();
  });
  el("fitBtn").onclick=()=>chart.timeScale().fitContent();
  el("resetBtn").onclick=()=>{chart.timeScale().fitContent();chart.priceScale("right").applyOptions({autoScale:true});};
  const sw=el("soundSwitch");
  sw.addEventListener("click",()=>{soundEnabled=!soundEnabled;sw.classList.toggle("on",soundEnabled);sw.setAttribute("aria-pressed",String(soundEnabled));if(soundEnabled)beep();});
  const ro=new ResizeObserver(entries=>{for(const entry of entries)chart.applyOptions({width:entry.contentRect.width,height:entry.contentRect.height});});
  ro.observe(chartEl);
  loadCandles(); fetchQuote(); connectSignalR();
  setInterval(()=>{if(!document.hidden)loadCandles();},60000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){loadCandles();fetchQuote();}});
})();
