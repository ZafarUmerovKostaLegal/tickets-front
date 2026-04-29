import { useState, useRef, useEffect } from 'react';
type AttendanceSelectProps = {
    value: string;
    options: readonly {
        value: string;
        label: string;
    }[];
    onChange: (value: string) => void;
    placeholder?: string;
};
export function AttendanceSelect({ value, options, onChange, placeholder = 'Выберите' }: AttendanceSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open)
            return;
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);
    const selected = options.find((o) => o.value === value);
    const label = selected?.label ?? placeholder;
    return (<div className="att-sel" ref={ref}>
      <button type="button" className={`att-sel__trigger${open ? ' att-sel__trigger--open' : ''}`} onClick={() => setOpen((v) => !v)} aria-haspopup="listbox" aria-expanded={open}>
        <span className="att-sel__value">{label}</span>
        <svg className="att-sel__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <div className={`att-sel__drop${open ? ' att-sel__drop--open' : ''}`} role="listbox">
        {options.map((o) => (<button key={o.value || '__all'} type="button" className={`att-sel__opt${value === o.value ? ' att-sel__opt--active' : ''}`} onClick={() => {
                onChange(o.value);
                setOpen(false);
            }}>
            {o.label}
          </button>))}
      </div>
    </div>);
}
