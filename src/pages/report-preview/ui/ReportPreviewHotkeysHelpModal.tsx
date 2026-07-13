import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { formatPrimaryShortcut } from '../lib/reportPreviewHotkeys';

type Props = {
    open: boolean;
    onClose: () => void;
    showDuplicate?: boolean;
};

export function ReportPreviewHotkeysHelpModal({ open, onClose, showDuplicate = true }: Props) {
    const uid = useId();

    useEffect(() => {
        if (!open)
            return;
        const h = (e: KeyboardEvent) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', h);
        return () => { document.removeEventListener('keydown', h); };
    }, [open, onClose]);

    if (!open)
        return null;

    return createPortal(
        <div className="tt-rp-brief-columns-modal-ov" role="presentation" onClick={onClose}>
            <div
                className="tt-rp-brief-columns-modal tt-rp-hotkeys-help-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={`${uid}-hotkeys-title`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="tt-rp-brief-columns-modal__head">
                    <h2 id={`${uid}-hotkeys-title`} className="tt-rp-brief-columns-modal__title">
                        Горячие клавиши
                    </h2>
                    <div className="tt-rp-brief-columns-modal__head-actions">
                        <button type="button" className="tt-rp-brief-columns-modal__x" onClick={onClose} aria-label="Закрыть">
                            ×
                        </button>
                    </div>
                </div>
                <div className="tt-rp-brief-columns-modal__body tt-rp-hotkeys-help-modal__body">
                    <p className="tt-rp-hotkeys-help-modal__lead">
                        На Windows и Linux используйте Ctrl, на macOS — ⌘.
                    </p>
                    <ul className="tt-rp-hotkeys-help-modal__list">
                        <li>
                            <kbd className="tt-rp-hotkeys-help-modal__kbd">{formatPrimaryShortcut('Z')}</kbd>
                            <span>
                                <strong>Отмена</strong>
                                {' — '}
                                вернуть последнее изменение ячейки, отменить создание / копию или восстановить случайно удалённую запись.
                            </span>
                        </li>
                        <li>
                            <kbd className="tt-rp-hotkeys-help-modal__kbd">{formatPrimaryShortcut('S')}</kbd>
                            <span>
                                <strong>Сохранить</strong>
                                {' — '}
                                сразу отправить все отложенные правки на сервер (без ожидания автосохранения).
                            </span>
                        </li>
                        {showDuplicate ? (
                            <li>
                                <kbd className="tt-rp-hotkeys-help-modal__kbd">{formatPrimaryShortcut('D')}</kbd>
                                <span>
                                    <strong>Копия</strong>
                                    {' — '}
                                    открыть дублирование активной строки. Сначала отредактируйте или нажмите действие у строки.
                                    Не срабатывает, пока курсор в поле ввода.
                                </span>
                            </li>
                        ) : null}
                    </ul>
                    <p className="tt-rp-hotkeys-help-modal__note">
                        Восстановленная после удаления запись подсвечивается на несколько секунд.
                        После «Обновить с сервера» история отмены очищается.
                    </p>
                </div>
                <div className="tt-rp-brief-columns-modal__foot">
                    <button type="button" className="tt-rp-brief-columns-modal__done" onClick={onClose}>
                        Понятно
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
}
