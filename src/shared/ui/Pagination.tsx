import './Pagination.css';

const DEFAULT_LIST_PAGE_SIZE = 24;

type PaginationProps = {
    page: number;
    totalCount: number;
    pageSize?: number;
    onPageChange: (nextPage: number) => void;
    loading?: boolean;
    className?: string;
};
export function Pagination({ page, totalCount, pageSize = DEFAULT_LIST_PAGE_SIZE, onPageChange, loading, className = '', }: PaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (totalCount <= pageSize)
        return null;
    return (<nav className={`tt-list-pagination${className ? ` ${className}` : ''}`} aria-label="Постраничная навигация">
      <button type="button" className="tt-list-pagination__btn" disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)}>
        Назад
      </button>
      <span className="tt-list-pagination__meta">
        Стр. {page} из {totalPages}
        <span className="tt-list-pagination__count"> · {totalCount} записей</span>
      </span>
      <button type="button" className="tt-list-pagination__btn" disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)}>
        Вперёд
      </button>
    </nav>);
}
