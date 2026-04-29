import { useCallback, useEffect, useState } from 'react';
import { tauriConnectShare } from '@entities/network-drive';
import { trimUnc } from '@shared/lib/uncPath';
import { NetworkDriveUserAccessPanel } from './NetworkDriveUserAccessPanel';
import './NetworkDriveExplorer.css';

type Props = {
    unc: string;
    username: string;
    password: string;
};

export function NetworkDriveExplorer(p: Props) {
    const [connected, setConnected] = useState(false);
    const [connectErr, setConnectErr] = useState<string | null>(null);
    const [connecting, setConnecting] = useState(false);

    const root = trimUnc(p.unc) || p.unc;

    useEffect(() => {
        setConnected(false);
    }, [p.unc]);

    const handleConnect = useCallback(async () => {
        if (!root || p.username.trim() === '') {
            setConnectErr('Укажите UNC, логин; пароль — при необходимости');
            return;
        }
        setConnecting(true);
        setConnectErr(null);
        try {
            await tauriConnectShare(root, p.username.trim(), p.password);
            setConnected(true);
        }
        catch (err) {
            setConnected(false);
            setConnectErr(err instanceof Error ? err.message : String(err));
        }
        finally {
            setConnecting(false);
        }
    }, [p.password, p.username, root]);

    return (
        <div className="ndrive-exp">
            <div className="ndrive-exp__toolbar">
                <div className="ndrive-exp__toolbar-actions">
                    <button
                        type="button"
                        className="ndrive__btn ndrive__btn--primary"
                        disabled={connecting || p.username.trim() === ''}
                        onClick={handleConnect}
                    >
                        {connecting ? 'Подключение…' : 'Подключить'}
                    </button>
                </div>
            </div>
            {connectErr && (
                <div className="ndrive-exp__err" role="alert">
                    {connectErr}
                </div>
            )}

            <div className="ndrive-exp__body">
                {connected && <NetworkDriveUserAccessPanel rootUnc={root} />}
                {!connected && (
                    <div className="ndrive-exp__empty" role="status">
                        Укажите учётные данные в шапке, затем нажмите «Подключить» и выполните сканирование доступа.
                    </div>
                )}
            </div>
        </div>
    );
}
