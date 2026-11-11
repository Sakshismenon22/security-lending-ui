import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType } from "lightweight-charts";
import "./SecurityPriceChart.css";

function toChartTime(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Math.floor(value > 1e12 ? value / 1000 : value);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
}

const ranges = [
  { label: "1D", days: 1 },
  { label: "1W", days: 7 },
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: null },
];

export default function SecurityPriceChart({ security, candles = [], loading = false }) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);
  const [range, setRange] = useState("ALL");
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);

  const chartData = useMemo(() => candles
    .map((candle) => ({
      time: toChartTime(candle.date),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close),
    }))
    .filter((candle) => candle.time && candle.open > 0 && candle.high > 0 && candle.low > 0 && candle.close > 0)
    .sort((a, b) => a.time - b.time)
    .filter((candle, index, rows) => index === 0 || candle.time > rows[index - 1].time),
  [candles]);

  const visibleData = useMemo(() => {
    const selected = ranges.find((item) => item.label === range);
    if (!selected?.days || !chartData.length) return chartData;
    const cutoff = chartData[chartData.length - 1].time - selected.days * 86400;
    return chartData.filter((item) => item.time >= cutoff);
  }, [chartData, range]);

  useEffect(() => {
    if (collapsed || !hostRef.current || !visibleData.length) return undefined;

    const chart = createChart(hostRef.current, {
      width: hostRef.current.clientWidth,
      height: maximized ? Math.max(420, window.innerHeight - 150) : 340,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#718096",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#f0f3f6" },
        horzLines: { color: "#edf1f5" },
      },
      rightPriceScale: { borderColor: "#e4eaf0", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: { borderColor: "#e4eaf0", timeVisible: true, secondsVisible: false },
      crosshair: { mode: 1 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chart.addSeries(CandlestickSeries, {
      upColor: "#089b72",
      downColor: "#df5965",
      borderUpColor: "#089b72",
      borderDownColor: "#df5965",
      wickUpColor: "#089b72",
      wickDownColor: "#df5965",
    }).setData(visibleData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) chart.applyOptions({ width });
    });
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [visibleData, collapsed, maximized]);

  return (
    <section className={`wf-tv-chart ${collapsed ? "is-collapsed" : ""} ${maximized ? "is-maximized" : ""}`}>
      <header className="wf-tv-toolbar">
        <div className="wf-tv-instrument">
          <strong>{security?.symbol ?? security?.ticker ?? `Security #${security?.id ?? ""}`}</strong>
          <span>{security?.name ?? security?.description ?? "Security price history"}</span>
        </div>
        <div className="wf-tv-actions">
          <button type="button" onClick={() => setCollapsed((value) => !value)} title={collapsed ? "Expand chart" : "Minimize chart"} aria-label={collapsed ? "Expand chart" : "Minimize chart"}>{collapsed ? "＋" : "－"}</button>
          <button type="button" onClick={() => { setCollapsed(false); setMaximized((value) => !value); }} title={maximized ? "Restore chart" : "Maximize chart"} aria-label={maximized ? "Restore chart" : "Maximize chart"}>{maximized ? "❐" : "□"}</button>
        </div>
      </header>
      {!collapsed && <>
        <div className="wf-tv-subtoolbar">
          <div className="wf-tv-ranges" aria-label="Chart time range">
            {ranges.map((item) => <button type="button" key={item.label} className={range === item.label ? "active" : ""} onClick={() => setRange(item.label)}>{item.label}</button>)}
          </div>
          <span className="wf-tv-hint">Scroll to zoom · Drag to pan</span>
        </div>
        {loading ? <div className="wf-tv-empty">Loading price history…</div> : visibleData.length ? <div className="wf-tv-canvas" ref={hostRef} /> : <div className="wf-tv-empty">No candlestick history is available for this security.</div>}
      </>}
    </section>
  );
}
