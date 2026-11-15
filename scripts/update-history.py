#!/usr/bin/env python3
"""Build a 6,000-bar XAUUSD M1 history cache.

Yahoo GC=F provides the deep one-minute history. Its COMEX futures prices are
aligned to the BiQuote MT5 XAUUSD spot-CFD feed using the median close basis
measured over matching timestamps. Matching recent bars are then replaced with
the actual BiQuote spot bars. This is a disclosed historical proxy, not an
exchange-certified spot history.
"""
import json
import math
import os
import statistics
import urllib.request
from datetime import datetime, timezone

YAHOO_URL = "https://query2.finance.yahoo.com/v8/finance/chart/GC%3DF?range=7d&interval=1m"
BIQUOTE_URL = "https://biquote.io/api/XAUUSD/ohlc?interval=1m&limit=1000"
TARGET = 6000
OUT = "data/xauusd-1m.json"

def get_json(url):
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 (GoldAnalyzerHistory/1.0)", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)

def as_epoch(value):
    if isinstance(value, (int, float)):
        return int(value)
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())

def valid_ohlc(row):
    return all(isinstance(row.get(k), (int, float)) and math.isfinite(row[k]) for k in ("open", "high", "low", "close"))

def main():
    yahoo_payload = get_json(YAHOO_URL)
    result = yahoo_payload.get("chart", {}).get("result") or []
    if not result:
        raise RuntimeError("Yahoo Finance returned no GC=F chart data")
    result = result[0]
    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]
    yahoo = {}
    for i, stamp in enumerate(timestamps):
        row = {key: (quote.get(key) or [None] * len(timestamps))[i] for key in ("open", "high", "low", "close")}
        if valid_ohlc(row):
            yahoo[int(stamp)] = row
    if len(yahoo) < TARGET:
        raise RuntimeError(f"Yahoo GC=F returned only {len(yahoo)} valid 1m bars; need {TARGET}")

    bq_payload = get_json(BIQUOTE_URL)
    spot = {}
    for row in bq_payload.get("bars", []):
        stamp = as_epoch(row["openTime"])
        normalized = {key: float(row[key]) for key in ("open", "high", "low", "close")}
        if valid_ohlc(normalized):
            spot[stamp] = normalized
    overlap = sorted(set(yahoo).intersection(spot))
    if len(overlap) < 30:
        raise RuntimeError(f"Only {len(overlap)} overlapping spot/futures bars; refusing to align")
    basis = statistics.median(spot[t]["close"] - yahoo[t]["close"] for t in overlap)

    # Do not let the futures feed extend beyond the latest real XAUUSD spot bar.
    # The chart must end on the actual MT5 spot series, not a later futures-only candle.
    latest_spot_time = max(spot)
    merged = {}
    for stamp, row in yahoo.items():
        if stamp > latest_spot_time:
            continue
        merged[stamp] = {
            "time": stamp,
            "open": round(row["open"] + basis, 5),
            "high": round(row["high"] + basis, 5),
            "low": round(row["low"] + basis, 5),
            "close": round(row["close"] + basis, 5),
            "source": "GC=F adjusted"
        }
    for stamp, row in spot.items():
        merged[stamp] = {
            "time": stamp,
            "open": row["open"],
            "high": row["high"],
            "low": row["low"],
            "close": row["close"],
            "source": "BiQuote XAUUSD MT5"
        }

    bars = sorted(merged.values(), key=lambda x: x["time"])[-TARGET:]
    if len(bars) != TARGET:
        raise RuntimeError(f"Final dataset has {len(bars)} bars, not {TARGET}")
    # The chart adapter consumes openTime ISO strings, just like BiQuote's API.
    for bar in bars:
        bar["openTime"] = datetime.fromtimestamp(bar["time"], timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        del bar["time"]
        bar["tickVolume"] = 0
        bar["volume"] = 0
        bar["isOpen"] = False

    output = {
        "symbol": "XAUUSD",
        "interval": "1m",
        "count": len(bars),
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "historySource": "Yahoo Finance COMEX Gold Futures GC=F, aligned by median basis to BiQuote MT5 XAUUSD spot-CFD",
        "alignment": {
            "method": "median close difference on exact overlapping minute timestamps",
            "overlapBars": len(overlap),
            "medianSpotMinusFuturesUsd": round(basis, 5),
            "recentSpotBarsReplaced": len(spot),
            "warning": "Older bars are adjusted COMEX futures proxy bars, not native XAUUSD spot candles."
        },
        "bars": bars
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    if os.path.exists(OUT):
        try:
            with open(OUT, encoding="utf-8") as file:
                previous = json.load(file)
            if previous.get("bars") == bars and previous.get("alignment") == output["alignment"]:
                print(f"History unchanged; keeping existing cache ({len(bars)} bars).")
                return
        except Exception:
            pass
    with open(OUT, "w", encoding="utf-8") as file:
        json.dump(output, file, separators=(",", ":"), ensure_ascii=False)
    print(f"PASS: wrote {len(bars)} M1 bars; overlap={len(overlap)}; basis={basis:.5f}; latest spot timestamp={latest_spot_time}; output={OUT}")

if __name__ == "__main__":
    main()
