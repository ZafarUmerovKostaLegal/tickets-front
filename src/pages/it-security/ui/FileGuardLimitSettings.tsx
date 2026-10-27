import { useEffect } from 'react';
import { createPortal } from 'react-dom';

type FileGuardLimitSettingsProps = {
    open: boolean;
    onClose: () => void;
    sharedInput: string;
    userInput: string;
    onSharedInput: (value: string) => void;
    onUserInput: (value: string) => void;
    sharedLimit: number | null | undefined;
    personalLimit: number | null | undefined;
    personalName: string;
    userSelected: boolean;
    busy: '' | 'shared' | 'user';
    error: string;
    onSaveShared: () => void;
    onSaveUser: () => void;
};

export function FileGuardLimitSettings({
    open,
    onClose,
    sharedInput,
    userInput,
    onSharedInput,
    onUserInput,
    sharedLimit,
    personalLimit,
    personalName,
    userSelected,
    busy,
    error,
    onSaveShared,
    onSaveUser,
}: FileGuardLimitSettingsProps) {
    useEffect(() => {
        if (!open)
            return undefined;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open)
        return null;

    const sharedNote = sharedLimit == null
        ? 'Пустое поле блокирует всех, у кого нет своего лимита.'
        : `Сейчас для всех: ${sharedLimit} МБ в день.`;
    const userNote = !userSelected
        ? 'Выберите пользователя слева, чтобы задать ему отдельный размер.'
        : personalLimit != null
            ? `Свой лимит: ${personalLimit} МБ в день. Пустое поле возвращает общий.`
            : sharedLimit != null
                ? `Своего лимита нет, действует общий: ${sharedLimit} МБ в день.`
                : 'Своего лимита нет, отправка блокируется.';

    return createPortal(
        <div className="its-limit" role="presentation" onClick={onClose}>
            <div
                className="its-limit__dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="its-limit-title"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="its-limit__head">
                    <div>
                        <h2 id="its-limit-title" className="its-limit__title">Лимит отправки</h2>
                        <p className="its-limit__lead">Сколько мегабайт можно отправить за день. Файл больше остатка блокируется.</p>
                    </div>
                    <button type="button" className="its-limit__close" aria-label="Закрыть" onClick={onClose}>×</button>
                </div>
                <div className="its-limit__body">
                    <section className="its-limit__card">
                        <div className="its-limit__card-title">Для всех</div>
                        <p className="its-limit__card-note">{sharedNote}</p>
                        <div className="its-limit__row">
                            <label className="its-limit__field">
                                <input
                                    type="number"
                                    min={0}
                                    max={100000}
                                    inputMode="numeric"
                                    value={sharedInput}
                                    placeholder="блок"
                                    aria-label="Общий лимит в мегабайтах за день"
                                    onChange={(event) => onSharedInput(event.target.value)}
                                />
                                <span className="its-limit__unit">МБ</span>
                            </label>
                            <button type="button" className="its-limit__save" disabled={busy !== ''} onClick={onSaveShared}>
                                {busy === 'shared' ? 'Сохраняем…' : 'Сохранить'}
                            </button>
                        </div>
                    </section>
                    <section className="its-limit__card">
                        <div className="its-limit__card-title">{userSelected ? personalName : 'Для пользователя'}</div>
                        <p className="its-limit__card-note">{userNote}</p>
                        <div className="its-limit__row">
                            <label className="its-limit__field">
                                <input
                                    type="number"
                                    min={0}
                                    max={100000}
                                    inputMode="numeric"
                                    value={userSelected ? userInput : ''}
                                    placeholder={userSelected ? 'общий' : 'выберите'}
                                    disabled={!userSelected}
                                    aria-label="Личный лимит в мегабайтах за день"
                                    onChange={(event) => onUserInput(event.target.value)}
                                />
                                <span className="its-limit__unit">МБ</span>
                            </label>
                            <button type="button" className="its-limit__save" disabled={!userSelected || busy !== ''} onClick={onSaveUser}>
                                {busy === 'user' ? 'Сохраняем…' : 'Сохранить'}
                            </button>
                        </div>
                    </section>
                    {error ? <p className="its-j__bad">{error}</p> : null}
                </div>
            </div>
        </div>,
        document.body,
    );
}
