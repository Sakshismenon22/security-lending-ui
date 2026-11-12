export default function FilterToolbar({ search, onSearchChange, placeholder = "Search records…", children, className = "filter-toolbar" }) {
  return (
    <div className={className}>
      {onSearchChange && (
        <label className="filter-toolbar-search">
          <span aria-hidden="true">⌕</span>
          <input value={search ?? ""} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} />
        </label>
      )}
      {children}
    </div>
  );
}
