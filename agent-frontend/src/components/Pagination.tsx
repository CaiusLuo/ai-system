import React from 'react';
import Button from './Button';

interface PaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ current, total, pageSize, onChange }) => {
  const totalPages = Math.ceil(total / pageSize);
  
  if (totalPages <= 1) return null;
  
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (current <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (current >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = current - 1; i <= current + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };
  
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-700">
        共 <span className="font-medium">{total}</span> 条记录，
        第 <span className="font-medium">{current}</span> / <span className="font-medium">{totalPages}</span> 页
      </div>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={current <= 1}
          onClick={() => onChange(current - 1)}
        >
          上一页
        </Button>
        
        {getPageNumbers().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' && onChange(page)}
            disabled={typeof page !== 'number'}
            className={`px-3 py-1.5 text-sm rounded-lg ${
              page === current
                ? 'bg-blue-600 text-white'
                : typeof page === 'number'
                ? 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                : 'bg-white text-gray-400 cursor-default'
            }`}
          >
            {page}
          </button>
        ))}
        
        <Button
          variant="ghost"
          size="sm"
          disabled={current >= totalPages}
          onClick={() => onChange(current + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  );
};

export default Pagination;
