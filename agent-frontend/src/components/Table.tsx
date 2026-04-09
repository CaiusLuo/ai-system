import React from 'react';

interface Column<T = any> {
  title: string;
  dataIndex: string;
  key: string;
  width?: string;
  render?: (value: any, record: T) => React.ReactNode;
}

interface TableProps<T = any> {
  columns: Column<T>[];
  dataSource: T[];
  loading?: boolean;
  rowKey?: string | ((record: T) => string | number);
  emptyText?: string;
}

function Table<T extends Record<string, any>>({
  columns,
  dataSource,
  loading = false,
  rowKey = 'id',
  emptyText = '暂无数据',
}: TableProps<T>) {
  const getRowKey = (record: T): string | number => {
    return typeof rowKey === 'function' ? rowKey(record) : record[rowKey as keyof T];
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    );
  }
  
  if (dataSource.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        {emptyText}
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.width || ''}`}
              >
                {column.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {dataSource.map(record => (
            <tr key={getRowKey(record)} className="hover:bg-gray-50">
              {columns.map(column => (
                <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {column.render 
                    ? column.render((record as any)[column.dataIndex], record)
                    : (record as any)[column.dataIndex]
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
