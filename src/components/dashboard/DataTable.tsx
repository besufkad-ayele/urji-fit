import React from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export default function DataTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl p-12 text-center">
        <p className="text-[rgb(90,102,96)] text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="bg-[#FCFAF6] border border-[#14201A]/10 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[#F3EFE5]/50 border-b border-[#14201A]/10">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="p-4 text-[11px] font-semibold uppercase tracking-wider text-[rgb(90,102,96)]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#14201A]/5">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className={`text-sm transition-colors ${
                  onRowClick ? 'cursor-pointer hover:bg-white/60' : ''
                }`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map((column) => (
                  <td key={column.key} className="p-4">
                    {column.render
                      ? column.render(item)
                      : String((item as any)[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
