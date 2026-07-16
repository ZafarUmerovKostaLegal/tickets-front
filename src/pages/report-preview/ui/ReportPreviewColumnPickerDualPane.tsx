import { useId, useRef, useState, type DragEvent, type ReactNode } from 'react';

type PaneKind = 'inactive' | 'active';

type DragPayload<T extends string> = {
    id: T;
    from: PaneKind;
};

type Props<T extends string> = {
    pool: readonly T[];
    labels: Record<T, string>;
    activeOrderedIds: T[];
    onChange: (next: T[]) => void;
};

const DND_MIME = 'application/x-tt-rp-col';

function parsePayload<T extends string>(raw: string): DragPayload<T> | null {
    try {
        const parsed = JSON.parse(raw) as DragPayload<T>;
        if (!parsed || typeof parsed.id !== 'string')
            return null;
        if (parsed.from !== 'inactive' && parsed.from !== 'active')
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}

function GripIcon() {
    return (<svg className="tt-rp-brief-columns__grip-ico" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="1.2"/>
      <circle cx="11" cy="3.5" r="1.2"/>
      <circle cx="5" cy="8" r="1.2"/>
      <circle cx="11" cy="8" r="1.2"/>
      <circle cx="5" cy="12.5" r="1.2"/>
      <circle cx="11" cy="12.5" r="1.2"/>
    </svg>);
}

export function ReportPreviewColumnPickerDualPane<T extends string>(p: Props<T>): ReactNode {
    const inactive = p.pool.filter((id) => !p.activeOrderedIds.includes(id));
    const [draggingId, setDraggingId] = useState<T | null>(null);
    const [overTarget, setOverTarget] = useState<{ pane: PaneKind; index: number } | null>(null);
    const dragRef = useRef<DragPayload<T> | null>(null);
    const uid = useId();

    const activateAt = (id: T, index: number) => {
        if (p.activeOrderedIds.includes(id))
            return;
        const next = [...p.activeOrderedIds];
        const clamped = Math.max(0, Math.min(index, next.length));
        next.splice(clamped, 0, id);
        p.onChange(next);
    };

    const deactivate = (id: T) => {
        if (p.activeOrderedIds.length <= 1)
            return;
        p.onChange(p.activeOrderedIds.filter((x) => x !== id));
    };

    const reorderActive = (id: T, toIndex: number) => {
        const from = p.activeOrderedIds.indexOf(id);
        if (from < 0)
            return;
        const next = [...p.activeOrderedIds];
        next.splice(from, 1);
        const clamped = Math.max(0, Math.min(toIndex > from ? toIndex - 1 : toIndex, next.length));
        next.splice(clamped, 0, id);
        p.onChange(next);
    };

    const onDragStart = (e: DragEvent, id: T, from: PaneKind) => {
        const payload: DragPayload<T> = { id, from };
        dragRef.current = payload;
        setDraggingId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DND_MIME, JSON.stringify(payload));
        e.dataTransfer.setData('text/plain', id);
    };

    const onDragEnd = () => {
        dragRef.current = null;
        setDraggingId(null);
        setOverTarget(null);
    };

    const resolvePayload = (e: DragEvent): DragPayload<T> | null => {
        const raw = e.dataTransfer.getData(DND_MIME) || e.dataTransfer.getData('text/plain');
        if (raw) {
            const parsed = parsePayload<T>(raw);
            if (parsed)
                return parsed;
            if (p.pool.includes(raw as T)) {
                const from: PaneKind = p.activeOrderedIds.includes(raw as T) ? 'active' : 'inactive';
                return { id: raw as T, from };
            }
        }
        return dragRef.current;
    };

    const onDragOverPane = (e: DragEvent, pane: PaneKind, index: number) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOverTarget({ pane, index });
    };

    const onDropAt = (e: DragEvent, pane: PaneKind, index: number) => {
        e.preventDefault();
        const payload = resolvePayload(e);
        onDragEnd();
        if (!payload || !p.pool.includes(payload.id))
            return;

        if (pane === 'active') {
            if (payload.from === 'inactive')
                activateAt(payload.id, index);
            else
                reorderActive(payload.id, index);
            return;
        }

        if (payload.from === 'active')
            deactivate(payload.id);
    };

    const renderItem = (id: T, pane: PaneKind, index: number) => {
        const isActive = pane === 'active';
        const canRemove = !isActive || p.activeOrderedIds.length > 1;
        const isDragging = draggingId === id;
        const isOver = overTarget?.pane === pane && overTarget.index === index;
        return (
            <li
                key={id}
                className={`tt-rp-brief-columns__li${isDragging ? ' tt-rp-brief-columns__li--dragging' : ''}${isOver ? ' tt-rp-brief-columns__li--over' : ''}`}
                onDragOver={(e) => onDragOverPane(e, pane, index)}
                onDrop={(e) => onDropAt(e, pane, index)}
            >
                <div
                    className={`tt-rp-brief-columns__item${isActive ? ' tt-rp-brief-columns__item--active' : ''}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, id, pane)}
                    onDragEnd={onDragEnd}
                >
                    <span className="tt-rp-brief-columns__grip" title="Перетащите" aria-hidden>
                        <GripIcon />
                    </span>
                    <button
                        type="button"
                        className="tt-rp-brief-columns__item-main"
                        onClick={() => {
                            if (isActive)
                                deactivate(id);
                            else
                                activateAt(id, p.activeOrderedIds.length);
                        }}
                        disabled={isActive && !canRemove}
                        title={isActive
                            ? (canRemove ? 'Убрать колонку из таблицы' : 'Должна остаться хотя бы одна колонка')
                            : 'Добавить колонку в таблицу'}
                    >
                        <span className="tt-rp-brief-columns__item-label">{p.labels[id]}</span>
                    </button>
                    <button
                        type="button"
                        className="tt-rp-brief-columns__item-hint-btn"
                        onClick={() => {
                            if (isActive)
                                deactivate(id);
                            else
                                activateAt(id, p.activeOrderedIds.length);
                        }}
                        disabled={isActive && !canRemove}
                        aria-label={isActive ? `Убрать «${p.labels[id]}»` : `Добавить «${p.labels[id]}»`}
                    >
                        <span className="tt-rp-brief-columns__item-hint" aria-hidden>
                            {isActive ? '×' : '→'}
                        </span>
                    </button>
                </div>
            </li>
        );
    };

    return (<>
      <p className="tt-rp-brief-columns__hint" id={`${uid}-hint`}>
        Перетащите колонки между списками или внутри «В таблице», чтобы изменить порядок. Можно также нажать пункт.
      </p>
      <div className="tt-rp-brief-columns__panes" aria-describedby={`${uid}-hint`}>
        <div
            className={`tt-rp-brief-columns__pane${overTarget?.pane === 'inactive' ? ' tt-rp-brief-columns__pane--drop' : ''}`}
            onDragOver={(e) => onDragOverPane(e, 'inactive', 0)}
            onDrop={(e) => onDropAt(e, 'inactive', 0)}
        >
          <span className="tt-rp-brief-columns__pane-label">Не показываются</span>
          <ul className="tt-rp-brief-columns__list" role="listbox" aria-label="Скрытые колонки">
            {inactive.length === 0 ? (
                <li className="tt-rp-brief-columns__empty">Все колонки включены</li>
            ) : (
                inactive.map((id, index) => renderItem(id, 'inactive', index))
            )}
            <li
                className={`tt-rp-brief-columns__dropzone${overTarget?.pane === 'inactive' && overTarget.index >= inactive.length ? ' tt-rp-brief-columns__dropzone--over' : ''}`}
                aria-hidden
                onDragOver={(e) => onDragOverPane(e, 'inactive', inactive.length)}
                onDrop={(e) => onDropAt(e, 'inactive', inactive.length)}
            />
          </ul>
        </div>
        <div className="tt-rp-brief-columns__divider" aria-hidden />
        <div
            className={`tt-rp-brief-columns__pane tt-rp-brief-columns__pane--active${overTarget?.pane === 'active' ? ' tt-rp-brief-columns__pane--drop' : ''}`}
            onDragOver={(e) => onDragOverPane(e, 'active', p.activeOrderedIds.length)}
            onDrop={(e) => onDropAt(e, 'active', p.activeOrderedIds.length)}
        >
          <span className="tt-rp-brief-columns__pane-label">В таблице</span>
          <ul className="tt-rp-brief-columns__list" role="listbox" aria-label="Видимые колонки">
            {p.activeOrderedIds.map((id, index) => renderItem(id, 'active', index))}
            <li
                className={`tt-rp-brief-columns__dropzone${overTarget?.pane === 'active' && overTarget.index >= p.activeOrderedIds.length ? ' tt-rp-brief-columns__dropzone--over' : ''}`}
                aria-hidden
                onDragOver={(e) => onDragOverPane(e, 'active', p.activeOrderedIds.length)}
                onDrop={(e) => onDropAt(e, 'active', p.activeOrderedIds.length)}
            />
          </ul>
        </div>
      </div>
    </>);
}
