/* =====================================================================
 *  FVG_OBFlipFVG_FIXED.js
 *  Chuyển từ Pine Script v5: "FVG Đa Ngày với Biên Độ Tùy Chọn"
 *  Gồm: FVG thường, FVG đảo chiều, obflipfvg và nhãn biên độ từng ngày.
 *  Dùng cho trang VN30 PRO (Lightweight Charts 4.x).
 *
 *  BẢN FIX:
 *    - Cảnh báo OBFlipFVG chỉ khi nến tạo tín hiệu đã đóng.
 *    - Không phát cảnh báo lịch sử khi tải chart lần đầu.
 *    - Không phát lại cảnh báo khi đổi timeframe/cấu hình hoặc reset.
 *    - Chống cảnh báo trùng cùng loại tín hiệu trên cùng thời điểm nến.
 * ===================================================================== */
(function (root) {
  "use strict";

  const CFG = {
    showFVG: true,
    showDay: true,
    mothuong: false,
    useBody: false,
    minRangePts: 1.6,
    maxRangePts: 3.0,
    showFlipFvg: false,
    minRangePtsFlip: 0,
    maxRangePtsFlip: 2.0,
    showObFlip: true,
    minObFlip: 0.0,
    maxObFlip: 3.0,
  };

  const COL = {
    bull: "rgba(76,175,80,0.30)", bullB: "rgba(76,175,80,0.30)",
    bear: "rgba(255,82,82,0.30)", bearB: "rgba(255,82,82,0.30)",
    bullFlip: "rgba(41,98,255,0.30)", bullFlipB: "#2962FF",
    bearFlip: "rgba(255,152,0,0.30)", bearFlipB: "#FF9800",
    obBull: "rgba(0,188,212,0.25)", obBullB: "#00BCD4",
    obBear: "rgba(224,64,251,0.25)", obBearB: "#E040FB",
    dayDone: "#FF9800", dayLive: "#FF9800",
    white: "#FFFFFF",
  };

  const VN_OFFSET = 7 * 3600;
  const TF_SEC = {
    "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
    "1h": 3600, "1H": 3600, "1D": 86400,
  };

  const dayKeyOf = (t) => Math.floor((t + VN_OFFSET) / 86400);
  const fmt1 = (v) => String(Math.round(v * 10) / 10);

  // Ghi nhận tín hiệu đã cảnh báo trong phiên hiện tại.
  const alertedObFlip = new Set();

  function emitObFlipAlert(isBull, candle, tfSec) {
    const eventId = isBull ? "obflipfvg.bullish" : "obflipfvg.bearish";
    const eventKey = eventId + ":" + String(candle.time);

    if (alertedObFlip.has(eventKey)) return;
    alertedObFlip.add(eventKey);

    const details = {
      time: candle.time,
      price: candle.close,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      direction: isBull ? "bullish" : "bearish",
      timeframe: tfSec,
      message: isBull ? "OBFlipFVG tăng" : "OBFlipFVG giảm",
    };

    // API cảnh báo của ứng dụng chủ (nếu được cung cấp).
    try {
      if (root.api && typeof root.api.alert === "function") {
        root.api.alert(eventId, details);
      } else if (
        root.context &&
        root.context.alerts &&
        typeof root.context.alerts.emit === "function"
      ) {
        root.context.alerts.emit(eventId, details);
      } else if (typeof root.dispatchEvent === "function" && typeof root.CustomEvent === "function") {
        root.dispatchEvent(new root.CustomEvent("fvg-alert", {
          detail: Object.assign({ eventId }, details)
        }));
      } else {
        console.warn("[FVGIndicator] Có tín hiệu " + eventId + " nhưng ứng dụng chưa cung cấp API cảnh báo.", details);
      }
    } catch (e) {
      console.error("[FVGIndicator] Không gửi được cảnh báo:", e);
    }
  }

  function aggregate(raw, sec) {
    const out = [];
    let cur = null;
    for (const c of raw) {
      const b = Math.floor(c.time / sec) * sec;
      if (!cur || cur.time !== b) {
        cur = { time: b, open: c.open, high: c.high, low: c.low, close: c.close };
        out.push(cur);
      } else {
        if (c.high > cur.high) cur.high = c.high;
        if (c.low < cur.low) cur.low = c.low;
        cur.close = c.close;
      }
    }
    return out;
  }

  let dailyTRCache = { source: null, length: -1, startIdx: 0, startKey: 0, map: null };

  function dailyTR(raw) {
    const n = raw ? raw.length : 0;
    const C = dailyTRCache;
    let map, start;

    if (
      C.map && C.source === raw && n >= C.length && n > C.startIdx &&
      dayKeyOf(raw[C.startIdx].time) === C.startKey &&
      (C.startIdx === 0 || dayKeyOf(raw[C.startIdx - 1].time) !== C.startKey)
    ) {
      map = C.map;
      start = C.startIdx;
    } else {
      map = new Map();
      start = 0;
    }

    let prevClose = start > 0 ? raw[start - 1].close : null;
    let cur = null;
    let curStart = start;

    const flush = () => {
      if (!cur) return;
      const hl = cur.h - cur.l;
      const tr = prevClose === null
        ? hl
        : Math.max(hl, Math.abs(cur.h - prevClose), Math.abs(cur.l - prevClose));
      map.set(cur.k, tr);
      prevClose = cur.c;
    };

    for (let i = start; i < n; i++) {
      const c = raw[i];
      const k = dayKeyOf(c.time);
      if (!cur || cur.k !== k) {
        flush();
        cur = { k, h: c.high, l: c.low, c: c.close };
        curStart = i;
      } else {
        if (c.high > cur.h) cur.h = c.high;
        if (c.low < cur.l) cur.l = c.low;
        cur.c = c.close;
      }
    }

    flush();
    dailyTRCache = {
      source: raw, length: n, startIdx: curStart,
      startKey: cur ? cur.k : 0, map,
    };
    return map;
  }

  function stepFvg(act, close, i) {
    for (let k = act.length - 1; k >= 0; k--) {
      const f = act[k];
      const broken = f.isBull ? close < f.bot : close > f.top;
      if (!broken) {
        f.drawn = true;
      } else {
        f.closed = true;
        f.end = i;
        act.splice(k, 1);
      }
    }
  }

  function stepOb(act, close, i) {
    for (let k = act.length - 1; k >= 0; k--) {
      const o = act[k];
      const broken = o.isBull ? close < o.bot : close > o.top;
      if (broken) {
        o.closed = true;
        o.end = i;
        act.splice(k, 1);
      }
    }
  }

  function computeFull(candles, raw, tfSec, cfg) {
    const n = candles.length;
    const res = {
      n, normal: [], flip: [], ob: [],
      high: new Float64Array(n),
      dayLabels: [],
      lastClose: n ? candles[n - 1].close : 0,
    };
    if (!n) return res;

    const dk = new Array(n);
    const cHi = new Float64Array(n);
    const cLo = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      const c = candles[i];
      dk[i] = dayKeyOf(c.time);
      cHi[i] = cfg.useBody ? Math.max(c.open, c.close) : c.high;
      cLo[i] = cfg.useBody ? Math.min(c.open, c.close) : c.low;
      res.high[i] = c.high;
    }

    let barsSince = 0;
    let lastIsBull = null;
    const actN = [], actF = [], actO = [];

    for (let i = 0; i < n; i++) {
      const c = candles[i];
      barsSince = (i === 0 || dk[i] !== dk[i - 1]) ? 0 : barsSince + 1;

      if (i >= 2) {
        const bullFVG = barsSince >= 2 && cLo[i] > cHi[i - 2];
        const bearFVG = barsSince >= 2 && cHi[i] < cLo[i - 2];

        const bullTop = cLo[i], bullBot = cHi[i - 2];
        const bearTop = cLo[i - 2], bearBot = cHi[i];
        const bullR = bullTop - bullBot;
        const bearR = bearTop - bearBot;

        const bullValid = bullFVG && bullR >= cfg.minRangePts && bullR <= cfg.maxRangePts;
        const bearValid = bearFVG && bearR >= cfg.minRangePts && bearR <= cfg.maxRangePts;

        const bullFlip = bullFVG && bullR >= cfg.minRangePtsFlip && bullR <= cfg.maxRangePtsFlip && lastIsBull === false;
        const bearFlip = bearFVG && bearR >= cfg.minRangePtsFlip && bearR <= cfg.maxRangePtsFlip && lastIsBull === true;

        if (bullFVG) lastIsBull = true;
        if (bearFVG) lastIsBull = false;

        const l0 = c.low, l1 = candles[i - 1].low, l2 = candles[i - 2].low;
        const h0 = c.high, h1 = candles[i - 1].high, h2 = candles[i - 2].high;

        const obBullIdx = (l0 <= l1 && l0 <= l2) ? 0 : (l1 <= l2 ? 1 : 2);
        const obBullHigh = obBullIdx === 0 ? h0 : obBullIdx === 1 ? h1 : h2;
        const obBullLow = Math.min(l0, l1, l2);

        const obBearIdx = (h0 >= h1 && h0 >= h2) ? 0 : (h1 >= h2 ? 1 : 2);
        const obBearLow = obBearIdx === 0 ? l0 : obBearIdx === 1 ? l1 : l2;
        const obBearHigh = Math.max(h0, h1, h2);

        const obBullRange = obBullHigh - obBullLow;
        const obBearRange = obBearHigh - obBearLow;

        const obBullOk = bullFlip && cfg.showObFlip && obBullRange >= cfg.minObFlip &&
          (cfg.maxObFlip === 0 || obBullRange <= cfg.maxObFlip);
        const obBearOk = bearFlip && cfg.showObFlip && obBearRange >= cfg.minObFlip &&
          (cfg.maxObFlip === 0 || obBearRange <= cfg.maxObFlip);

        if (cfg.mothuong) {
          if (bullValid) {
            const f = { born: i, top: bullTop, bot: bullBot, isBull: true, drawn: true, closed: false, end: -1 };
            res.normal.push(f); actN.push(f);
          }
          if (bearValid) {
            const f = { born: i, top: bearTop, bot: bearBot, isBull: false, drawn: true, closed: false, end: -1 };
            res.normal.push(f); actN.push(f);
          }
        }

        if (cfg.showFlipFvg) {
          if (bullFlip) {
            const f = { born: i, top: bullTop, bot: bullBot, isBull: true, drawn: true, closed: false, end: -1 };
            res.flip.push(f); actF.push(f);
          }
          if (bearFlip) {
            const f = { born: i, top: bearTop, bot: bearBot, isBull: false, drawn: true, closed: false, end: -1 };
            res.flip.push(f); actF.push(f);
          }
        }

        if (obBullOk) {
          const o = { left: i - obBullIdx, top: obBullHigh, bot: obBullLow, isBull: true, closed: false, end: -1 };
          res.ob.push(o); actO.push(o);
        }
        if (obBearOk) {
          const o = { left: i - obBearIdx, top: obBearHigh, bot: obBearLow, isBull: false, closed: false, end: -1 };
          res.ob.push(o); actO.push(o);
        }
      }

      stepFvg(actN, c.close, i);
      stepFvg(actF, c.close, i);
      stepOb(actO, c.close, i);
    }

    const trMap = dailyTR(raw && raw.length ? raw : candles);
    let dStart = 0;
    let dHi = candles[0].high;
    let dLo = candles[0].low;

    for (let i = 1; i < n; i++) {
      if (dk[i] !== dk[i - 1]) {
        const tr = trMap.has(dk[i - 1]) ? trMap.get(dk[i - 1]) : dHi - dLo;
        res.dayLabels.push({ idx: Math.trunc((dStart + i - 1) / 2), text: fmt1(tr), live: false });
        dStart = i;
        dHi = candles[i].high;
        dLo = candles[i].low;
      } else {
        if (candles[i].high > dHi) dHi = candles[i].high;
        if (candles[i].low < dLo) dLo = candles[i].low;
      }
    }
    res.dayLabels.push({ idx: Math.trunc((dStart + n - 1) / 2), text: fmt1(dHi - dLo), live: true });
    return res;
  }

  const SIG_STRIDE = 4096;
  const EMPTY_F64 = new Float64Array(0);

  function newEngine() {
    return {
      n: 0, tfSec: 0, cfgVer: -1, lastTime: 0, sig: [],
      cap: 0, dk: null, cHi: null, cLo: null, high: null,
      normal: [], flip: [], ob: [],
      actN: [], actF: [], actO: [],
      barsSince: 0, lastIsBull: null, flipTop: NaN, flipBot: NaN,
      ck: null, jr: [], rec: false,
      res: {},
    };
  }

  function resetEngine(E) {
    E.n = 0; E.lastTime = 0; E.sig = []; E.cap = 0;
    E.dk = E.cHi = E.cLo = E.high = null;
    E.normal = []; E.flip = []; E.ob = [];
    E.actN = []; E.actF = []; E.actO = [];
    E.barsSince = 0; E.lastIsBull = null;
    E.flipTop = NaN; E.flipBot = NaN;
    E.ck = null; E.jr = []; E.rec = false;
  }

  function ensureCap(E, n) {
    if (E.cap >= n) return;
    const cap = Math.max(n + 8192, Math.ceil(E.cap * 1.5));
    const grow = (A, T) => {
      const B = new T(cap);
      if (A) B.set(A);
      return B;
    };
    E.dk = grow(E.dk, Int32Array);
    E.cHi = grow(E.cHi, Float64Array);
    E.cLo = grow(E.cLo, Float64Array);
    E.high = grow(E.high, Float64Array);
    E.cap = cap;
  }

  function stepFvgJ(E, act, close, i) {
    const jr = E.jr;
    const rec = E.rec;
    for (let k = act.length - 1; k >= 0; k--) {
      const f = act[k];
      const broken = f.isBull ? close < f.bot : close > f.top;
      if (!broken) {
        if (rec && !f.drawn) jr.push(f, f.drawn, f.closed, f.end);
        f.drawn = true;
      } else {
        if (rec) jr.push(f, f.drawn, f.closed, f.end);
        f.closed = true; f.end = i; act.splice(k, 1);
      }
    }
  }

  function stepObJ(E, act, close, i) {
    const jr = E.jr;
    const rec = E.rec;
    for (let k = act.length - 1; k >= 0; k--) {
      const o = act[k];
      const broken = o.isBull ? close < o.bot : close > o.top;
      if (broken) {
        if (rec) jr.push(o, o.drawn, o.closed, o.end);
        o.closed = true; o.end = i; act.splice(k, 1);
      }
    }
  }

  // allowCloseAlert chỉ true cho nến vừa chuyển từ đang chạy sang đã đóng.
  function stepCandle(E, candles, i, cfg, allowCloseAlert) {
    const c = candles[i];
    const dk = E.dk;
    const cHi = E.cHi;
    const cLo = E.cLo;

    dk[i] = dayKeyOf(c.time);
    cHi[i] = cfg.useBody ? Math.max(c.open, c.close) : c.high;
    cLo[i] = cfg.useBody ? Math.min(c.open, c.close) : c.low;
    E.high[i] = c.high;

    E.barsSince = (i === 0 || dk[i] !== dk[i - 1]) ? 0 : E.barsSince + 1;

    if (i >= 2) {
      const bullFVG = E.barsSince >= 2 && cLo[i] > cHi[i - 2];
      const bearFVG = E.barsSince >= 2 && cHi[i] < cLo[i - 2];

      const bullTop = cLo[i], bullBot = cHi[i - 2];
      const bearTop = cLo[i - 2], bearBot = cHi[i];
      const bullR = bullTop - bullBot;
      const bearR = bearTop - bearBot;

      const bullValid = bullFVG && bullR >= cfg.minRangePts && bullR <= cfg.maxRangePts;
      const bearValid = bearFVG && bearR >= cfg.minRangePts && bearR <= cfg.maxRangePts;

      const lastIsBull = E.lastIsBull;
      const bullFlip = bullFVG && bullR >= cfg.minRangePtsFlip &&
        bullR <= cfg.maxRangePtsFlip && lastIsBull === false;
      const bearFlip = bearFVG && bearR >= cfg.minRangePtsFlip &&
        bearR <= cfg.maxRangePtsFlip && lastIsBull === true;

      if (bullFVG) E.lastIsBull = true;
      if (bearFVG) E.lastIsBull = false;

      const l0 = c.low, l1 = candles[i - 1].low, l2 = candles[i - 2].low;
      const h0 = c.high, h1 = candles[i - 1].high, h2 = candles[i - 2].high;

      const obBullIdx = (l0 <= l1 && l0 <= l2) ? 0 : (l1 <= l2 ? 1 : 2);
      const obBullHigh = obBullIdx === 0 ? h0 : obBullIdx === 1 ? h1 : h2;
      const obBullLow = Math.min(l0, l1, l2);

      const obBearIdx = (h0 >= h1 && h0 >= h2) ? 0 : (h1 >= h2 ? 1 : 2);
      const obBearLow = obBearIdx === 0 ? l0 : obBearIdx === 1 ? l1 : l2;
      const obBearHigh = Math.max(h0, h1, h2);

      const obBullRange = obBullHigh - obBullLow;
      const obBearRange = obBearHigh - obBearLow;

      const obBullOk = bullFlip && cfg.showObFlip &&
        obBullRange >= cfg.minObFlip &&
        (cfg.maxObFlip === 0 || obBullRange <= cfg.maxObFlip);
      const obBearOk = bearFlip && cfg.showObFlip &&
        obBearRange >= cfg.minObFlip &&
        (cfg.maxObFlip === 0 || obBearRange <= cfg.maxObFlip);

      if (cfg.mothuong) {
        if (bullValid) {
          const f = { born: i, top: bullTop, bot: bullBot, isBull: true, drawn: true, closed: false, end: -1 };
          E.normal.push(f); E.actN.push(f);
        }
        if (bearValid) {
          const f = { born: i, top: bearTop, bot: bearBot, isBull: false, drawn: true, closed: false, end: -1 };
          E.normal.push(f); E.actN.push(f);
        }
      }

      if (cfg.showFlipFvg) {
        if (bullFlip) {
          const f = { born: i, top: bullTop, bot: bullBot, isBull: true, drawn: true, closed: false, end: -1 };
          E.flip.push(f); E.actF.push(f);
        }
        if (bearFlip) {
          const f = { born: i, top: bearTop, bot: bearBot, isBull: false, drawn: true, closed: false, end: -1 };
          E.flip.push(f); E.actF.push(f);
        }
      }

      if (obBullOk) {
        const o = { born: i, left: i - obBullIdx, top: obBullHigh, bot: obBullLow, isBull: true, closed: false, end: -1 };
        E.ob.push(o); E.actO.push(o);
        if (allowCloseAlert) emitObFlipAlert(true, c, E.tfSec);
      }

      if (obBearOk) {
        const o = { born: i, left: i - obBearIdx, top: obBearHigh, bot: obBearLow, isBull: false, closed: false, end: -1 };
        E.ob.push(o); E.actO.push(o);
        if (allowCloseAlert) emitObFlipAlert(false, c, E.tfSec);
      }
    }

    stepFvgJ(E, E.actN, c.close, i);
    stepFvgJ(E, E.actF, c.close, i);
    stepObJ(E, E.actO, c.close, i);
  }

  function saveCheckpoint(E) {
    E.ck = {
      bs: E.barsSince, lib: E.lastIsBull,
      ft: E.flipTop, fb: E.flipBot,
      an: E.actN.slice(), af: E.actF.slice(), ao: E.actO.slice(),
      nl: E.normal.length, fl: E.flip.length, ol: E.ob.length,
    };
    E.jr = [];
  }

  function rollback(E) {
    const jr = E.jr;
    for (let j = jr.length - 4; j >= 0; j -= 4) {
      const o = jr[j];
      o.drawn = jr[j + 1]; o.closed = jr[j + 2]; o.end = jr[j + 3];
    }
    E.jr = [];

    const ck = E.ck;
    E.barsSince = ck.bs;
    E.lastIsBull = ck.lib;
    E.flipTop = ck.ft;
    E.flipBot = ck.fb;
    E.actN = ck.an; E.actF = ck.af; E.actO = ck.ao;
    E.normal.length = ck.nl; E.flip.length = ck.fl; E.ob.length = ck.ol;
  }

  function makeSig(candles, n) {
    const sig = [];
    const push = (i) => {
      const c = candles[i];
      sig.push(i, c.time, c.open, c.high, c.low, c.close);
    };
    for (let i = 0; i < n - 1; i += SIG_STRIDE) push(i);
    if (n >= 2) push(n - 2);
    return sig;
  }

  function sigOk(E, candles) {
    const sig = E.sig;
    for (let k = 0; k < sig.length; k += 6) {
      const c = candles[sig[k]];
      if (!c || c.time !== sig[k + 1] || c.open !== sig[k + 2] ||
        c.high !== sig[k + 3] || c.low !== sig[k + 4] || c.close !== sig[k + 5]) {
        return false;
      }
    }
    return true;
  }

  function canResume(E, candles, tfSec, cfgVer) {
    const n = candles.length;
    return E.n > 0 && E.ck && n >= E.n &&
      E.tfSec === tfSec && E.cfgVer === cfgVer &&
      candles[E.n - 1].time === E.lastTime && sigOk(E, candles);
  }

  function advance(E, candles, raw, tfSec, cfg, cfgVer) {
    const n = candles.length;
    const res = E.res;

    if (!n) {
      resetEngine(E);
      return {
        n: 0, normal: [], flip: [], ob: [],
        high: EMPTY_F64, dayLabels: [], lastClose: 0,
      };
    }

    const resumable = canResume(E, candles, tfSec, cfgVer);
    // Chỉ được phép cảnh báo nếu engine tiếp tục cùng dữ liệu và vừa có nến mới.
    // Lần nạp đầu, đổi khung, đổi cấu hình hoặc reset đều không cảnh báo lịch sử.
    const newBarArrived = resumable && n > E.n;

    let start;
    if (resumable) {
      rollback(E);
      start = E.n - 1;
    } else {
      resetEngine(E);
      start = 0;
    }

    ensureCap(E, n);

    for (let i = start; i < n; i++) {
      if (i === n - 1) {
        saveCheckpoint(E);
        E.rec = true;
      }
      const allowCloseAlert = newBarArrived && i === n - 2;
      stepCandle(E, candles, i, cfg, allowCloseAlert);
    }

    E.rec = false;
    E.n = n;
    E.tfSec = tfSec;
    E.cfgVer = cfgVer;
    E.lastTime = candles[n - 1].time;
    E.sig = makeSig(candles, n);

    res.n = n;
    res.normal = E.normal;
    res.flip = E.flip;
    res.ob = E.ob;
    res.high = E.high;
    res.lastClose = candles[n - 1].close;

    const dk = E.dk;
    const trMap = dailyTR(raw && raw.length ? raw : candles);
    const dayLabels = [];
    let dStart = 0;
    let dHi = candles[0].high;
    let dLo = candles[0].low;

    for (let i = 1; i < n; i++) {
      if (dk[i] !== dk[i - 1]) {
        const tr = trMap.has(dk[i - 1]) ? trMap.get(dk[i - 1]) : dHi - dLo;
        dayLabels.push({ idx: Math.trunc((dStart + i - 1) / 2), text: fmt1(tr), live: false });
        dStart = i; dHi = candles[i].high; dLo = candles[i].low;
      } else {
        if (candles[i].high > dHi) dHi = candles[i].high;
        if (candles[i].low < dLo) dLo = candles[i].low;
      }
    }

    dayLabels.push({ idx: Math.trunc((dStart + n - 1) / 2), text: fmt1(dHi - dLo), live: true });
    res.dayLabels = dayLabels;
    return res;
  }

  const S = {
    chart: null, series: null, container: null, canvas: null, ctx: null,
    res: null, input: null, lastKey: "", cfgVer: 0, ver: 0, lastSig: "",
    eng: newEngine(),
  };

  function plotSize() {
    let pw = 56, th = 26;
    try { pw = S.chart.priceScale("right").width(); } catch (e) {}
    try { th = S.chart.timeScale().height(); } catch (e) {}
    return { pw, th };
  }

  function fitCanvas() {
    const w = S.container.clientWidth;
    const h = S.container.clientHeight;
    const dpr = root.devicePixelRatio || 1;
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (S.canvas.width !== cw || S.canvas.height !== ch) {
      S.canvas.width = cw; S.canvas.height = ch;
    }
    S.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S.ctx.clearRect(0, 0, w, h);
    return { w, h };
  }

  function render() {
    if (!S.chart || !S.ctx) return;
    const { w, h } = fitCanvas();
    const res = S.res;
    if (!res || !res.n) return;

    const ts = S.chart.timeScale();
    const vr = ts.getVisibleLogicalRange();
    if (!vr) return;

    const { pw, th } = plotSize();
    const W = w - pw, H = h - th;
    const X = (i) => ts.logicalToCoordinate(i);
    const Y = (p) => S.series.priceToCoordinate(p);
    const n = res.n;
    const ctx = S.ctx;

    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();

    const box = (left, right, top, bot, fill, stroke) => {
      if (right < vr.from - 1 || left > vr.to + 1) return;
      const x1 = X(left), x2 = X(right), y1 = Y(top), y2 = Y(bot);
      if (x1 == null || x2 == null || y1 == null || y2 == null) return;
      ctx.fillStyle = fill;
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = stroke; ctx.lineWidth = 1;
      ctx.strokeRect(x1 + 0.5, y1 + 0.5, x2 - x1, y2 - y1);
    };

    const liveRight = n - 1 + 3;

    if (CFG.showFVG && CFG.mothuong) {
      for (const f of res.normal) {
        if (!f.drawn) continue;
        box(f.born - 2, f.closed ? f.end : liveRight, f.top, f.bot,
          f.isBull ? COL.bull : COL.bear, f.isBull ? COL.bullB : COL.bearB);
      }
    }

    if (CFG.showFVG && CFG.showFlipFvg) {
      for (const f of res.flip) {
        if (!f.drawn) continue;
        box(f.born - 2, f.closed ? f.end : liveRight, f.top, f.bot,
          f.isBull ? COL.bullFlip : COL.bearFlip, f.isBull ? COL.bullFlipB : COL.bearFlipB);
      }
    }

    if (CFG.showFVG && CFG.showObFlip) {
      for (const o of res.ob) {
        box(o.left, o.closed ? o.end : liveRight, o.top, o.bot,
          o.isBull ? COL.obBull : COL.obBear, o.isBull ? COL.obBullB : COL.obBearB);
      }
    }

    if (CFG.showDay) {
      ctx.font = "normal 20px Arial";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      for (const L of res.dayLabels) {
        if (L.idx < vr.from - 10 || L.idx > vr.to + 10) continue;
        const x = X(L.idx), yHigh = Y(res.high[L.idx]);
        if (x == null || yHigh == null) continue;
        const tw = ctx.measureText(L.text).width;
        const bw = tw + 12, bh = 20;
        const tip = yHigh - 4, by = tip - 5 - bh;
        ctx.fillStyle = L.live ? COL.dayLive : COL.dayDone;
        ctx.fillRect(x - bw / 2, by, bw, bh);
        ctx.beginPath();
        ctx.moveTo(x - 5, by + bh); ctx.lineTo(x, tip); ctx.lineTo(x + 5, by + bh);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = COL.white;
        ctx.fillText(L.text, x, by + bh / 2);
      }
    }

    ctx.restore();
  }

  function signature() {
    const r = S.chart.timeScale().getVisibleLogicalRange();
    const ref = S.res && S.res.n ? S.res.lastClose : 0;
    return [
      r ? r.from.toFixed(3) : "",
      r ? r.to.toFixed(3) : "",
      S.series.priceToCoordinate(ref),
      S.series.priceToCoordinate(ref + 50),
      S.container.clientWidth, S.container.clientHeight, S.ver,
    ].join("|");
  }

  function loop() {
    root.requestAnimationFrame(loop);
    try {
      const sig = signature();
      if (sig !== S.lastSig) {
        S.lastSig = sig;
        render();
      }
    } catch (e) {
      console.error("[FVGIndicator] lỗi vẽ:", e);
    }
  }

  function recompute() {
    const inp = S.input;
    if (!inp) return;
    try {
      S.res = advance(S.eng, inp.candles, inp.raw, inp.tfSec, CFG, S.cfgVer);
    } catch (e) {
      console.error("[FVGIndicator] lỗi tính toán:", e);
    }
    S.ver++;
  }

  function addButtons() {
    const bar = document.querySelector(".topbar");
    if (!bar) return;
    const sp = bar.querySelector(".spacer");
    const div = document.createElement("div");
    div.className = "divider";
    const grp = document.createElement("div");
    grp.className = "group";

    [["FVG", "showFVG"], ["Biên độ", "showDay"]].forEach(([label, key]) => {
      const b = document.createElement("button");
      b.className = "tool" + (CFG[key] ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        CFG[key] = !CFG[key];
        b.classList.toggle("active", CFG[key]);
        S.ver++;
      });
      grp.appendChild(b);
    });

    bar.insertBefore(div, sp);
    bar.insertBefore(grp, sp);
  }

  function init(o) {
    S.chart = o.chart;
    S.series = o.series;
    S.container = o.container;

    if (o.rightOffset != null) {
      S.chart.applyOptions({ timeScale: { rightOffset: o.rightOffset } });
    }

    const cv = document.createElement("canvas");
    cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;z-index:4;pointer-events:none;";
    S.container.appendChild(cv);
    S.canvas = cv;
    S.ctx = cv.getContext("2d");

    addButtons();
    loop();
  }

  function update(candles, raw, tf) {
    if (!S.chart || !candles) return;
    const n = candles.length;
    const tfSec = TF_SEC[tf] || (n > 1 ? candles[1].time - candles[0].time : 60);
    const last = n ? candles[n - 1] : {};
    const rl = raw && raw.length ? raw[raw.length - 1] : {};

    const key = [
      tfSec, n, n ? candles[0].time : 0,
      last.time, last.high, last.low, last.close,
      raw ? raw.length : 0, rl.time, rl.high, rl.low, rl.close, S.cfgVer,
    ].join("|");

    S.input = { candles, raw: raw || [], tfSec };
    if (key !== S.lastKey) {
      S.lastKey = key;
      recompute();
    } else {
      S.ver++;
    }
  }

  function setConfig(patch) {
    Object.assign(CFG, patch || {});
    S.cfgVer++;
    S.lastKey = "";
    recompute();
  }

  function reset() {
    dailyTRCache = { source: null, length: -1, startIdx: 0, startKey: 0, map: null };
    resetEngine(S.eng);
    S.lastKey = "";
    recompute();
  }

  const api = {
    init, update, setConfig, reset,
    config: CFG,
    alerts: [
      { id: "obflipfvg.bullish", label: "OBFlipFVG tăng" },
      { id: "obflipfvg.bearish", label: "OBFlipFVG giảm" },
    ],
    _compute: computeFull,
    _advance: advance,
    _newEngine: newEngine,
    _render: render,
    _S: S,
  };

  root.FVGIndicator = api;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

})(typeof window !== "undefined" ? window : globalThis);
