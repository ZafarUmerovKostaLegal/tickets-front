import { useState, useRef, useEffect, useMemo } from 'react';
type AttendanceDatePickerProps = {
    value: string;
    onChange: (value: string) => void;
};
export function AttendanceDatePicker({ value, onChange }: AttendanceDatePickerProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = value ? new Date(value) : new Date();
    const [month, setMonth] = useState(current.getMonth());
    const [year, setYear] = useState(current.getFullYear());
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
    useEffect(() => {
        if (!value)
            return;
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) {
            setMonth(d.getMonth());
            setYear(d.getFullYear());
        }
    }, [value]);
    const days = useMemo(() => {
        const firstOfMonth = new Date(year, month, 1);
        const startDay = (firstOfMonth.getDay() + 6) % 7;
        const startDate = new Date(year, month, 1 - startDay);
        const result: {
            date: Date;
            inCurrentMonth: boolean;
        }[] = [];
        for (let i = 0; i < 42; i += 1) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            result.push({ date: d, inCurrentMonth: d.getMonth() === month });
        }
        return result;
    }, [month, year]);
    const handleSelect = (d: Date) => {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        onChange(`${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
        setOpen(false);
    };
    const goMonth = (delta: number) => {
        const d = new Date(year, month + delta, 1);
        setYear(d.getFullYear());
        setMonth(d.getMonth());
    };
    const isToday = (d: Date) => {
        const t = new Date();
        return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
    };
    return (<div className="att-dp" ref={ref}>
      <button type="button" className="att-dp__trigger" onClick={() => setOpen((v) => !v)}>
        <span className="att-dp__val">{value || 'Выберите дату'}</span>
        <svg className="att-dp__cal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="17" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>
      <div className={`att-dp__drop${open ? ' att-dp__drop--open' : ''}`}>
        <div className="att-dp__nav">
          <button type="button" onClick={() => goMonth(-1)} aria-label="Предыдущий месяц">‹</button>
          <span>{new Date(year, month, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
          <button type="button" onClick={() => goMonth(1)} aria-label="Следующий месяц">›</button>
        </div>
        <div className="att-dp__weekdays">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (<span key={d}>{d}</span>))}
        </div>
        <div className="att-dp__grid">
          {days.map(({ date, inCurrentMonth }) => {
            const iso = date.toISOString().slice(0, 10);
            const selected = value === iso;
            return (<button key={iso} type="button" className={[
                    'att-dp__day',
                    !inCurrentMonth && 'att-dp__day--dim',
                    selected && 'att-dp__day--sel',
                    isToday(date) && 'att-dp__day--today',
                ]
                    .filter(Boolean)
                    .join(' ')} onClick={() => handleSelect(date)}>
                {date.getDate()}
              </button>);
        })}
        </div>
      </div>
    </div>);
}
