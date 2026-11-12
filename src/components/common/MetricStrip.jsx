export default function MetricStrip({ items = [], className = "metric-strip", itemClassName = "metric-strip-item" }) {
  return (
    <div className={className}>
      {items.map((item) => (
        <div className={itemClassName} key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </div>
  );
}
