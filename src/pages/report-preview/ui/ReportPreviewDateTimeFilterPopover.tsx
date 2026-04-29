import { ReportPreviewFilterPopover } from './ReportPreviewFilterPopover';
export function ReportPreviewDateTimeFilterPopover({ whenQuery, onWhenQueryChange, recordedOrder, onRecordedOrderChange, }: {
    whenQuery: string;
    onWhenQueryChange: (q: string) => void;
    recordedOrder: 'asc' | 'desc';
    onRecordedOrderChange: (o: 'asc' | 'desc') => void;
}) {
    return (<ReportPreviewFilterPopover aria-label="Фильтр и порядок: дата и время записи" title="Порядок и поиск по дате/времени">
      <div className="tt-rp-xlf__section">
        <div className="tt-rp-xlf__section-title">Порядок строк</div>
        <button type="button" role="menuitemradio" aria-checked={recordedOrder === 'asc'} className={`tt-rp-xlf__opt${recordedOrder === 'asc' ? ' tt-rp-xlf__opt--active' : ''}`} onClick={() => onRecordedOrderChange('asc')}>
          Сначала старые записи
        </button>
        <button type="button" role="menuitemradio" aria-checked={recordedOrder === 'desc'} className={`tt-rp-xlf__opt${recordedOrder === 'desc' ? ' tt-rp-xlf__opt--active' : ''}`} onClick={() => onRecordedOrderChange('desc')}>
          Сначала новые записи
        </button>
        <p className="tt-rp-xlf__hint">По моменту времени записи (и дате работы).</p>
      </div>
      <div className="tt-rp-xlf__sep" />
      <div className="tt-rp-xlf__section">
        <div className="tt-rp-xlf__section-title">Поиск в таблице</div>
        <input type="search" className="tt-rp-xlf__search-input" value={whenQuery} onChange={(e) => onWhenQueryChange(e.target.value)} placeholder="Дата, ISO, время…" autoComplete="off" spellCheck={false} />
        <p className="tt-rp-xlf__hint">Ищет по дате работы, ISO, локальному времени и подсказкам в ячейке.</p>
      </div>
    </ReportPreviewFilterPopover>);
}
