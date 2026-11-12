export default function StatusBadge({ value = "Pending", className = "status-badge" }) {
  const label = String(value || "Pending").replaceAll("_", " ").toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());

  return <span className={className}>{label}</span>;
}
