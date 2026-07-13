import { useCallback, useEffect, useId } from 'react';
import { NetworkDriveCredentialsForm } from './NetworkDriveCredentialsForm';

type Props = {
    open: boolean;
    onClose: () => void;
    unc: string;
    onUncChange: (v: string) => void;
    username: string;
    onUsernameChange: (v: string) => void;
    password: string;
    onPasswordChange: (v: string) => void;
    rememberSessionPassword: boolean;
    onRememberSessionPasswordChange: (v: boolean) => void;
    onSave: () => void;
    onClear: () => void;
    hasSaved: boolean;
    lastSavedAt: string | null;
};

export function NetworkDriveCredentialsModal(p: Props) {
    const titleId = useId();

    const onKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && p.open) {
                e.preventDefault();
                p.onClose();
            }
        },
        [p],
    );

    useEffect(() => {
        if (!p.open) {
            return;
        }
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = prev;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [p.open, onKeyDown]);

    if (!p.open) {
        return null;
    }

    return (
        <div
            className="ndrive-credmodal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div className="ndrive-credmodal__panel">
                <div className="ndrive-credmodal__head">
                    <h2 className="ndrive-credmodal__title" id={titleId}>
                        Подключение к сети
                    </h2>
                    <button
                        type="button"
                        className="ndrive-credmodal__x"
                        onClick={p.onClose}
                        aria-label="Закрыть"
                    >
                        ×
                    </button>
                </div>
                <NetworkDriveCredentialsForm
                    variant="modal"
                    onRequestClose={p.onClose}
                    unc={p.unc}
                    onUncChange={p.onUncChange}
                    username={p.username}
                    onUsernameChange={p.onUsernameChange}
                    password={p.password}
                    onPasswordChange={p.onPasswordChange}
                    rememberSessionPassword={p.rememberSessionPassword}
                    onRememberSessionPasswordChange={p.onRememberSessionPasswordChange}
                    onSave={p.onSave}
                    onClear={p.onClear}
                    hasSaved={p.hasSaved}
                    lastSavedAt={p.lastSavedAt}
                />
            </div>
        </div>
    );
}
