import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { isNetDriveConfigReady } from '@entities/network-drive';
import { AppBackButton, AppHomeLogo, AppPageSettings } from '@shared/ui';
import { useNetDrivePageState } from '../model/useNetDrivePageState';
import { NetworkDriveCredentialsModal } from './NetworkDriveCredentialsModal';
import { NetworkDriveExplorer } from './NetworkDriveExplorer';
import './NetworkDriveAccessPage.css';
export function NetworkDriveAccessPage() {
    const s = useNetDrivePageState();
    const showSaved = s.settings != null && isNetDriveConfigReady(s.settings);
    const [credOpen, setCredOpen] = useState(false);
    return (_jsxs("div", { className: "ndrive", children: [_jsxs("main", { className: "ndrive__main", children: [_jsx("header", { className: "ndrive__header", children: _jsxs("div", { className: "ndrive__header-inner", children: [_jsxs("div", { className: "ndrive__header-start", children: [_jsx(AppBackButton, { className: "app-back-btn" }), _jsx(AppHomeLogo, { withSeparator: true }), _jsx("h1", { className: "ndrive__title ndrive__title--compact", children: "\u0421\u0435\u0442\u0435\u0432\u043E\u0439 \u0434\u0438\u0441\u043A" })] }), _jsxs("div", { className: "ndrive__header-end", children: [_jsx("button", { type: "button", className: "ndrive__btn ndrive__btn--ghost", onClick: () => setCredOpen(true), children: "\u0423\u0447\u0451\u0442\u043D\u044B\u0435 \u0434\u0430\u043D\u043D\u044B\u0435" }), _jsx("div", { className: "app-page-header-end", children: _jsx(AppPageSettings, {}) })] })] }) }), _jsx("div", { className: "ndrive__content ndrive__content--fs", children: _jsx("div", { className: "ndrive__fs-shell", children: _jsx(NetworkDriveExplorer, { unc: s.unc, username: s.username, password: s.password }) }) })] }), _jsx(NetworkDriveCredentialsModal, { open: credOpen, onClose: () => setCredOpen(false), unc: s.unc, onUncChange: s.setUnc, username: s.username, onUsernameChange: s.setUsername, password: s.password, onPasswordChange: s.setPassword, rememberSessionPassword: s.rememberSessionPassword, onRememberSessionPasswordChange: s.setRememberSessionPassword, onSave: s.saveCredentials, onClear: s.clearAllSaved, hasSaved: showSaved, lastSavedAt: s.settings?.updatedAt ?? null })] }));
}
