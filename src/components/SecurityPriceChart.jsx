import { useEffect, useMemo, useRef, useState } from "react";
import { createChart, CandlestickSeries, ColorType } from "lightweight-charts";
import { Client } from "@stomp/stompjs";
import "./SecurityPriceChart.css";

function toChartTime(value) {
  if (value == null) return null;
  if (typeof value === "number") {
    return Math.floor(value > 1e12 ? value / 1000 : value);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : Math.floor(parsed.getTime() / 1000);
}

const IST_TIME_ZONE = "Asia/Kolkata";

function formatIstTime(time) {
  const epochSeconds = typeof time === "number"
    ? time
    : time && typeof time === "object" && "year" in time
      ? Date.UTC(time.year, time.month - 1, time.day) / 1000
      : null;
  if (epochSeconds == null) return "";
  return new Date(epochSeconds * 1000).toLocaleString("en-IN", {
    timeZone: IST_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
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
  const seriesRef = useRef(null);
  const [range, setRange] = useState("ALL");
  const [collapsed, setCollapsed] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [liveCandles, setLiveCandles] = useState([]);
  const [streamStatus, setStreamStatus] = useState("CONNECTING");

  const historicalData = useMemo(() => candles
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

  useEffect(() => {
    setLiveCandles(historicalData);
  }, [historicalData, security?.id]);

  useEffect(() => {
    const symbol = security?.symbol ?? security?.ticker;
    if (!symbol) return undefined;

    const marketDataHttpUrl = import.meta.env.VITE_MARKET_DATA_API || "http://localhost:8080";
    const websocketUrl = import.meta.env.VITE_MARKET_DATA_WS
      || marketDataHttpUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:") + "/ws";
    const client = new Client({
      brokerURL: websocketUrl,
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        setStreamStatus("LIVE");
        client.subscribe(`/topic/price/${symbol}`, (message) => {
          try {
            const update = JSON.parse(message.body);
            if (update.symbol && String(update.symbol).toUpperCase() !== String(symbol).toUpperCase()) return;
            const candle = {
              time: toChartTime(update.tradeDateTimestamp ?? update.tradedDateTimestamp ?? update.timestamp),
              open: Number(update.open),
              high: Number(update.high),
              low: Number(update.low),
              close: Number(update.close),
            };
            if (!candle.time || ![candle.open, candle.high, candle.low, candle.close].every((value) => Number.isFinite(value) && value > 0)) return;
            setLiveCandles((previous) => {
              const next = [...previous];
              const last = next[next.length - 1];
              if (last && candle.time < last.time) {
                const existingIndex = next.findIndex((item) => item.time === candle.time);
                if (existingIndex >= 0) next[existingIndex] = candle;
                else return previous;
              } else if (last && candle.time === last.time) {
                next[next.length - 1] = candle;
              } else {
                next.push(candle);
              }
              return next;
            });
          } catch (error) {
            console.error("Unable to process market-price WebSocket message:", error);
          }
        });
      },
      onDisconnect: () => setStreamStatus("CONNECTING"),
      onWebSocketClose: () => setStreamStatus("RECONNECTING"),
      onStompError: (frame) => {
        console.error("Market-price STOMP error:", frame.headers?.message, frame.body);
        setStreamStatus("RECONNECTING");
      },
      onWebSocketError: (error) => {
        console.error("Market-price WebSocket error:", error);
        setStreamStatus("RECONNECTING");
      },
    });

    setStreamStatus("CONNECTING");
    client.activate();
    return () => {
      setStreamStatus("CONNECTING");
      client.deactivate();
    };
  }, [security?.id, security?.symbol, security?.ticker]);

  const chartData = liveCandles;

  const visibleData = useMemo(() => {
    const selected = ranges.find((item) => item.label === range);
    if (!selected?.days || !chartData.length) return chartData;
    const cutoff = chartData[chartData.length - 1].time - selected.days * 86400;
    return chartData.filter((item) => item.time >= cutoff);
  }, [chartData, range]);

  useEffect(() => {
    if (collapsed || !hostRef.current) return undefined;

    const chart = createChart(hostRef.current, {
      width: hostRef.current.clientWidth,
      height: maximized ? Math.max(420, window.innerHeight - 150) : 340,
      layout: {
        background: { type: ColorType.Solid, color: "#ffffff" },
        textColor: "#718096",
        fontFamily: "Inter, Arial, sans-serif",
        fontSize: 11,
      },
      localization: {
        locale: "en-IN",
        timeFormatter: formatIstTime,
      },
      grid: {
        vertLines: { color: "#f0f3f6" },
        horzLines: { color: "#edf1f5" },
      },
      rightPriceScale: { borderColor: "#e4eaf0", scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        borderColor: "#e4eaf0",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time) => formatIstTime(time),
      },
      crosshair: { mode: 1 },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#089b72",
      downColor: "#df5965",
      borderUpColor: "#089b72",
      borderDownColor: "#df5965",
      wickUpColor: "#089b72",
      wickDownColor: "#df5965",
    });
    if (visibleData.length) {
      candleSeries.setData(visibleData);
      chart.timeScale().fitContent();
    }
    chartRef.current = chart;
    seriesRef.current = candleSeries;

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      if (width > 0) chart.applyOptions({ width });
    });
    observer.observe(hostRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [collapsed, maximized]);

  useEffect(() => {
    if (!chartRef.current || !visibleData.length) return;
    if (seriesRef.current) seriesRef.current.setData(visibleData);
    chartRef.current.timeScale().fitContent();
  }, [visibleData]);

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
          <span className="wf-tv-hint"><i className={`wf-tv-stream-dot ${streamStatus === "LIVE" ? "live" : ""}`} />{streamStatus === "LIVE" ? "Live feed connected" : streamStatus === "RECONNECTING" ? "Reconnecting to live feed…" : "Connecting to live feed…"} · Scroll to zoom · Drag to pan</span>
        </div>
        {loading ? <div className="wf-tv-empty">Loading price history…</div> : visibleData.length ? <div className="wf-tv-canvas" ref={hostRef} /> : <div className="wf-tv-empty">No candlestick history is available for this security.</div>}
      </>}
    </section>
  );
}
