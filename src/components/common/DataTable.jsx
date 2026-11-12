export default function DataTable({ rows = [], columns = [], empty = "No records found", wrapperClass = "data-table-wrap", tableClass = "data-table", emptyClass = "data-table-empty", rowKey }) {
  const getKey = (row, index) => rowKey ? rowKey(row, index) : row.id ?? row.locateId ?? row.reservationId ?? index;

  return (
    <div className={wrapperClass}>
      <table className={tableClass}>
        <thead>
          <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={getKey(row, index)}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : (row[column.key] ?? "—")}
                </td>
              ))}
            </tr>
          )) : (
            <tr><td colSpan={columns.length || 1} className={emptyClass}>{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
