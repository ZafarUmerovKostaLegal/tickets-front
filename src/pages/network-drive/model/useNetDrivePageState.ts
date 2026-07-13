import { useCallback, useEffect, useState } from 'react';
import {
    clearNetDriveSettings,
    clearSessionPassword,
    DEFAULT_GRPDATA_UNC,
    loadAccessDrafts,
    loadNetDriveSettings,
    loadSessionPassword,
    type NetDriveAccessRuleDraft,
    type NetDriveSettings,
    saveAccessDrafts,
    saveNetDriveSettings,
    saveSessionPassword,
} from '@entities/network-drive';

function newRuleId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        return crypto.randomUUID();
    return `nd-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useNetDrivePageState() {
    const [settings, setSettings] = useState<NetDriveSettings | null>(() => loadNetDriveSettings());
    const [unc, setUnc] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rememberSessionPassword, setRememberSessionPassword] = useState(false);

    const [rules, setRules] = useState<NetDriveAccessRuleDraft[]>(() => loadAccessDrafts());
    const [formPath, setFormPath] = useState('');
    const [formPrincipal, setFormPrincipal] = useState('');
    const [formRights, setFormRights] = useState<NetDriveAccessRuleDraft['rights']>('Read');

    useEffect(() => {
        const s = loadNetDriveSettings();
        setUnc(s?.unc && s.unc.trim() !== '' ? s.unc : DEFAULT_GRPDATA_UNC);
        setUsername(s?.username ?? '');
        const pwd = loadSessionPassword();
        if (pwd != null && pwd !== '') {
            setPassword(pwd);
            setRememberSessionPassword(true);
        }
    }, []);

    const saveCredentials = useCallback(() => {
        if (unc.trim() === '' || username.trim() === '')
            return;
        saveNetDriveSettings(unc.trim(), username.trim());
        if (rememberSessionPassword)
            saveSessionPassword(password);
        else
            clearSessionPassword();
        setSettings(loadNetDriveSettings());
    }, [unc, username, password, rememberSessionPassword]);

    const clearAllSaved = useCallback(() => {
        clearNetDriveSettings();
        clearSessionPassword();
        setSettings(null);
        setUnc(DEFAULT_GRPDATA_UNC);
        setUsername('');
        setPassword('');
        setRememberSessionPassword(false);
    }, []);

    const persistRules = useCallback((next: NetDriveAccessRuleDraft[]) => {
        setRules(next);
        saveAccessDrafts(next);
    }, []);

    const addRule = useCallback(() => {
        const p = formPath.trim();
        const pr = formPrincipal.trim();
        if (p === '' || pr === '')
            return;
        const next: NetDriveAccessRuleDraft[] = [
            ...rules,
            { id: newRuleId(), path: p, principal: pr, rights: formRights },
        ];
        persistRules(next);
        setFormPath('');
        setFormPrincipal('');
        setFormRights('Read');
    }, [formPath, formPrincipal, formRights, rules, persistRules]);

    const removeRule = useCallback((id: string) => {
        setRules((prev) => {
            const next = prev.filter((r) => r.id !== id);
            saveAccessDrafts(next);
            return next;
        });
    }, []);

    const onRememberPasswordChange = useCallback((checked: boolean) => {
        setRememberSessionPassword(checked);
        if (!checked) {
            clearSessionPassword();
            setPassword('');
        }
    }, []);

    return {
        unc,
        setUnc,
        username,
        setUsername,
        password,
        setPassword,
        rememberSessionPassword,
        setRememberSessionPassword: onRememberPasswordChange,
        saveCredentials,
        clearAllSaved,
        settings,
        hasSavedCredentials: settings != null && settings.username.trim() !== '' && settings.unc.trim() !== '',

        rules,
        formPath,
        setFormPath,
        formPrincipal,
        setFormPrincipal,
        formRights,
        setFormRights,
        addRule,
        removeRule,
    };
}
