import { getHistoricalRates, getRealTimeRates } from 'dukascopy-node';
import fs from 'node:fs';

const now = Date.now();
const from = new Date(now - 14 * 24 * 60 * 60 * 1000);
const to = new Date(now);
const report = {
  provider: 'Dukascopy',
  instrument: 'xauusd',
  timeframe: 'm1',
  priceType: 'bid',
  testedAt: new Date(now).toISOString(),
  historical: {},
  realtime: {},
  errors: []
};

try {
  console.log('Downloading 14 calendar days of XAUUSD M1 from Dukascopy...');
  const rows = await getHistoricalRates({
    instrument: 'xauusd',
    dates: { from, to },
    timeframe: 'm1',
    priceType: 'bid',
    format: 'json',
    volumes: true,
    ignoreFlats: false,
    batchSize: 8,
    pauseBetweenBatchesMs: 1200,
    retryCount: 2,
    rateLimitRetryCount: 3
  });
  const sorted = [...rows].sort((a, b) => a.timestamp - b.timestamp);
  const unique = sorted.filter((r, i) => i === 0 || r.timestamp !== sorted[i - 1].timestamp);
  const gaps = [];
  for (let i = 1; i < unique.length; i++) {
    const delta = unique[i].timestamp - unique[i - 1].timestamp;
    if (delta > 60_000 && delta <= 6 * 60 * 60 * 1000) gaps.push({
      after: new Date(unique[i - 1].timestamp).toISOString(),
      before: new Date(unique[i].timestamp).toISOString(),
      minutes: Math.round(delta / 60_000)
    });
  }
  const last = unique.at(-1);
  report.historical = {
    requestedFrom: from.toISOString(),
    requestedTo: to.toISOString(),
    returnedRows: rows.length,
    uniqueRows: unique.length,
    firstCandle: unique[0] ? { ...unique[0], timeISO: new Date(unique[0].timestamp).toISOString() } : null,
    lastCandle: last ? { ...last, timeISO: new Date(last.timestamp).toISOString() } : null,
    latestCandleAgeMinutes: last ? Math.round((Date.now() - last.timestamp) / 60_000) : null,
    gapsWithinSixHours: gaps.length,
    sampleGaps: gaps.slice(0, 20),
    passed5000: unique.length >= 5000
  };
  console.log(JSON.stringify(report.historical, null, 2));
} catch (e) {
  report.errors.push({ stage: 'historical', message: String(e?.stack || e) });
}

try {
  console.log('Fetching latest real-time XAUUSD M1 candles...');
  const first = await getRealTimeRates({
    instrument: 'xauusd',
    timeframe: 'm1',
    priceType: 'bid',
    format: 'json',
    last: 5
  });
  report.realtime.firstPoll = first;
  await new Promise(resolve => setTimeout(resolve, 65_000));
  const second = await getRealTimeRates({
    instrument: 'xauusd',
    timeframe: 'm1',
    priceType: 'bid',
    format: 'json',
    last: 5
  });
  report.realtime.secondPoll = second;
  const a = first?.at(-1);
  const b = second?.at(-1);
  report.realtime.comparison = {
    firstLatest: a ? { ...a, timeISO: new Date(a.timestamp).toISOString() } : null,
    secondLatest: b ? { ...b, timeISO: new Date(b.timestamp).toISOString() } : null,
    timestampAdvanced: !!a && !!b && b.timestamp > a.timestamp,
    closeChanged: !!a && !!b && b.close !== a.close,
    pollIntervalSeconds: 65,
    note: 'If market is closed, no new M1 candle is expected; endpoint reachability and latest available candle are still assessed.'
  };
} catch (e) {
  report.errors.push({ stage: 'realtime', message: String(e?.stack || e) });
}

fs.writeFileSync('dukascopy-probe-report.json', JSON.stringify(report, null, 2));
console.log('REPORT_WRITTEN');
console.log(JSON.stringify({
  historicalRows: report.historical?.uniqueRows,
  passed5000: report.historical?.passed5000,
  realtimeReturned: report.realtime?.firstPoll?.length,
  realtimeSecondPollReturned: report.realtime?.secondPoll?.length,
  realtimeComparison: report.realtime?.comparison,
  errors: report.errors
}, null, 2));

if (!report.historical?.passed5000 || !report.realtime?.firstPoll?.length || report.errors.length) {
  process.exitCode = 1;
}
