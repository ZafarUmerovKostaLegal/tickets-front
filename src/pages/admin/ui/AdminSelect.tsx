import { useState, useRef, useEffect } from 'react';
type AdminSelectProps = {
    value: string;
    options: {
        value: string;
        label: string;
    }[];
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
};
export function AdminSelect({ value, options, onChange, placeholder = 'Выберите', disabled = false, }: AdminSelectProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);
    const [direction, setDirection] = useState<'down' | 'up'>('down');
    useEffect(() => {
        if (!open)
            return;
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node))
                setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [open]);
    const selected = options.find((o) => o.value === value);
    const label = selected?.label ?? placeholder;
    useEffect(() => {
        if (!open || !ref.current)
            return;
        const rect = ref.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const preferUp = spaceBelow < 220 && rect.top > spaceBelow;
        setDirection(preferUp ? 'up' : 'down');
    }, [open]);
    return (<div className="ap-sel" ref={ref}>
      <button type="button" className={`ap-sel__trigger${open ? ' ap-sel__trigger--open' : ''}${disabled ? ' ap-sel__trigger--disabled' : ''}`} onClick={() => !disabled && setOpen((v) => !v)} disabled={disabled} aria-haspopup="listbox" aria-expanded={open}>
        <span className="ap-sel__value">{label}</span>
        <svg className="ap-sel__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div className={`ap-sel__drop${open ? ' ap-sel__drop--open' : ''}${direction === 'up' ? ' ap-sel__drop--up' : ''}`} role="listbox">
        {options.map((o) => (<button key={o.value} type="button" className={`ap-sel__opt${value === o.value ? ' ap-sel__opt--active' : ''}`} onClick={() => { onChange(o.value); setOpen(false); }}>
            {o.label}
          </button>))}
      </div>
    </div>);
}
