import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { tauriConnectShare } from '@entities/network-drive';
import { trimUnc } from '@shared/lib/uncPath';
import { NetworkDriveUserAccessPanel } from './NetworkDriveUserAccessPanel';
import './NetworkDriveExplorer.css';
export function NetworkDriveExplorer(p) {
    const [connected, setConnected] = useState(false);
    const [connectErr, setConnectErr] = useState(null);
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
    return (_jsxs("div", { className: "ndrive-exp", children: [_jsx("div", { className: "ndrive-exp__toolbar", children: _jsx("div", { className: "ndrive-exp__toolbar-actions", children: _jsx("button", { type: "button", className: "ndrive__btn ndrive__btn--primary", disabled: connecting || p.username.trim() === '', onClick: handleConnect, children: connecting ? 'Подключение…' : 'Подключить' }) }) }), connectErr && (_jsx("div", { className: "ndrive-exp__err", role: "alert", children: connectErr })), _jsxs("div", { className: "ndrive-exp__body", children: [connected && _jsx(NetworkDriveUserAccessPanel, { rootUnc: root }), !connected && (_jsx("div", { className: "ndrive-exp__empty", role: "status", children: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0443\u0447\u0451\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435 \u0432 \u0448\u0430\u043F\u043A\u0435, \u0437\u0430\u0442\u0435\u043C \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u00AB\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u00BB \u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u0434\u043E\u0441\u0442\u0443\u043F\u0430." }))] })] }));
}
