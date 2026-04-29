import { ReportPreviewFilterPopover } from './ReportPreviewFilterPopover';
export function ReportPreviewTextFilterPopover({ 'aria-label': ariaLabel, title, value, onChange, placeholder, hint, }: {
    'aria-label': string;
    title?: string;
    value: string;
    onChange: (next: string) => void;
    placeholder: string;
    hint?: string;
}) {
    return (<ReportPreviewFilterPopover aria-label={ariaLabel} title={title}>
      <div className="tt-rp-xlf__section">
        <div className="tt-rp-xlf__section-title">Поиск</div>
        <input type="search" className="tt-rp-xlf__search-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} />
        {hint ? (<p className="tt-rp-xlf__hint">{hint}</p>) : null}
      </div>
    </ReportPreviewFilterPopover>);
}
