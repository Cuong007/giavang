import { getHistoricalRates, getRealTimeRates } from 'dukascopy-node';
import fs from 'node:fs';

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const TARGET_M1 = 6000;
const OUT = 'data/dukascopy-xauusd.json';
const config = { instrument: 'xauusd', priceType: 'bid', format: 'json', volumes: true,
  ignoreFlats: false, batchSize: 8, pauseBetweenBatchesMs: 900,
  retryCount: 2, rateLimitRetryCount: 3 };
const specs = [
  ['m1', 14 * DAY, 0],
  ['m5', 1000 * 5 * 60 * 1000 * 1.25, 1000],
  ['m15', 1000 * 15 * 60 * 1000 * 1.25, 1000],
  ['m30', 1000 * 30 * 60 * 1000 * 1.25, 1000],
  ['h1', 1000 * 60 * 60 * 1000 * 1.25, 1000],
  ['h4', 1000 * 4 * 60 * 60 * 1000 * 1.25, 1000],
  ['d1', 1000 * DAY * 1.25, 1000]
];
const clean = rows => {
  const map = new Map();
  for (const r of rows || []) {
    const timestamp = Number(r.timestamp);
    const vals = [r.open,r.high,r.low,r.close].map(Number);
    if (!Number.isFinite(timestamp) || !vals.every(Number.isFinite)) continue;
    map.set(timestamp, { timestamp, open: vals[0], high: vals[1], low: vals[2], close: vals[3], volume: Number(r.volume || 0) });
  }
  return [...map.values()].sort((a,b)=>a.timestamp-b.timestamp);
};
const report = { provider:'Dukascopy', symbol:'XAUUSD', priceType:'bid', generatedAt:new Date(now).toISOString(), timeframes:{}, errors:[] };

for (const [tf, lookback, limit] of specs) {
  const from = new Date(now - lookback);
  console.log('Downloading XAUUSD', tf, 'from', from.toISOString());
  try {
    const rows = await getHistoricalRates({ ...config, dates:{ from, to:new Date(now) }, timeframe:tf });
    let bars = clean(rows);
    if (tf === 'm1') bars = bars.slice(-TARGET_M1);
    else bars = bars.slice(-limit);
    if (tf === 'm1' && bars.length < TARGET_M1) throw new Error('Only '+bars.length+' M1 bars; minimum '+TARGET_M1);
    if (!bars.length) throw new Error('No bars returned');
    report.timeframes[tf] = bars;
    console.log('PASS',tf,bars.length,'bars',new Date(bars[0].timestamp).toISOString(),'to',new Date(bars.at(-1).timestamp).toISOString());
  } catch (e) {
    report.errors.push({timeframe:tf,message:String(e?.stack||e)});
    if (tf === 'm1') throw e;
    console.error('Timeframe failed:',tf,e);
  }
}

// Try to get the current unfinished M1 candle. Empty output is normal while market is closed.
try {
  const live = clean(await getRealTimeRates({ ...config, timeframe:'m1', last:10 }));
  report.timeframes.m1 = clean([...(report.timeframes.m1||[]), ...live]).slice(-TARGET_M1);
  report.liveM1 = live.slice(-5);
  console.log('Realtime M1 returned',live.length);
} catch (e) {
  report.errors.push({timeframe:'realtime-m1',message:String(e?.stack||e)});
  report.liveM1 = [];
}

// Tick feed provides the freshest bid/ask quote when the market is open.
try {
  const ticks = await getRealTimeRates({ instrument:'xauusd', timeframe:'tick', format:'json', last:10, priceType:'bid' });
  const t = Array.isArray(ticks) ? ticks.at(-1) : null;
  if (t) {
    const bid = Number(t.bidPrice), ask = Number(t.askPrice);
    const timestamp = Number(t.timestamp);
    const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid+ask)/2 : bid;
    report.quote = { bid, ask, mid, timestamp, isLive: Number.isFinite(timestamp) && now-timestamp <= 120000 };
  }
} catch (e) {
  report.errors.push({timeframe:'realtime-tick',message:String(e?.stack||e)});
}
const latestM1 = report.timeframes.m1.at(-1);
if (!report.quote && latestM1) report.quote = { bid:latestM1.close, ask:null, mid:latestM1.close, timestamp:latestM1.timestamp, isLive:false };
report.history = {
  count: report.timeframes.m1.length,
  first: report.timeframes.m1[0]?.timestamp ?? null,
  last: latestM1?.timestamp ?? null,
  ageMinutes: latestM1 ? Math.round((now-latestM1.timestamp)/60000) : null,
  liveTick: Boolean(report.quote?.isLive),
  timeframeCounts: Object.fromEntries(Object.entries(report.timeframes).map(([k,v])=>[k,v.length]))
};
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(OUT,JSON.stringify(report));
console.log('WROTE',OUT,JSON.stringify(report.history));
if (report.timeframes.m1.length < TARGET_M1) process.exitCode=1;
