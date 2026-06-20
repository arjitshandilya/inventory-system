import "../styles/table.css";

/**
 * columns: [{ key, header, render?(row), align?, width? }]
 * rows: array of data objects, each needs a unique `id`
 */
export function DataTable({ columns, rows, getRowKey = (row) => row.id }) {
  return (
    <div className="table-wrap surface">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{ textAlign: col.align || "left", width: col.width }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((col) => (
                <td key={col.key} style={{ textAlign: col.align || "left" }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
