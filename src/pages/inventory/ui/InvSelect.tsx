import { useState, useEffect, useRef } from 'react';
type InvSelectProps = {
    value: string | number | '';
    placeholder?: string;
    options: {
        value: string | number;
        label: string;
    }[];
    onChange: (value: string | number | '') => void;
};
export function InvSelect({ value, placeholder = 'Выберите', options, onChange }: InvSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const fn = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', fn);
        return () => document.removeEventListener('mousedown', fn);
    }, [open]);
    const selected = options.find((o) => o.value === value);
    return (<div className="inv-sel" ref={ref}>
      <button type="button" className={`inv-sel__trigger${open ? ' inv-sel__trigger--open' : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="inv-sel__value">{selected?.label ?? placeholder}</span>
        <svg className="inv-sel__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <div className={`inv-sel__drop${open ? ' inv-sel__drop--open' : ''}`} role="listbox">
        <button type="button" className={`inv-sel__opt${value === '' ? ' inv-sel__opt--active' : ''}`} onClick={() => {
            onChange('');
            setOpen(false);
        }}>
          {placeholder}
        </button>
        {options.map((o) => (<button key={String(o.value)} type="button" className={`inv-sel__opt${value === o.value ? ' inv-sel__opt--active' : ''}`} onClick={() => {
                onChange(o.value);
                setOpen(false);
            }}>
            {o.label}
          </button>))}
      </div>
    </div>);
}
