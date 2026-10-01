import { useCallback, useEffect, useState } from 'react';
import { deleteAccountingSetting, listAccountingSettings, saveAccountingSetting, type AccountingSetting } from '@entities/hr';

const KEY_RE = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

export function AccountingSettingsPanel() {
    const [items, setItems] = useState<AccountingSetting[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [draftKey, setDraftKey] = useState('');
    const [draftValue, setDraftValue] = useState('');
    const [savingKey, setSavingKey] = useState('');

    const reload = useCallback(() => {
        setLoading(true);
        setError('');
        void listAccountingSettings()
            .then((next) => setItems(next))
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось загрузить настройки'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        reload();
    }, [reload]);

    const save = (key: string, value: string) => {
        const cleaned = key.trim();
        if (!KEY_RE.test(cleaned)) {
            setError('Ключ: латиница, затем цифры, точка, дефис или подчёркивание');
            return;
        }
        setSavingKey(cleaned);
        setError('');
        void saveAccountingSetting(cleaned, value)
            .then(() => {
                setDraftKey('');
                setDraftValue('');
                reload();
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось сохранить'))
            .finally(() => setSavingKey(''));
    };

    const remove = (key: string) => {
        setSavingKey(key);
        setError('');
        void deleteAccountingSetting(key)
            .then(() => reload())
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Не удалось удалить'))
            .finally(() => setSavingKey(''));
    };

    return (
        <section className="acct-settings" aria-label="Настройки бухгалтерии">
            <p className="acct-settings__lead">
                Параметры хранятся в сервисе HR. Их видят и меняют администраторы и партнёры.
            </p>
            {error ? <p className="acct-settings__error" role="alert">{error}</p> : null}
            {loading ? <p className="acct-settings__muted">Загрузка…</p> : null}
            {!loading && items.length === 0 && !error ? (
                <p className="acct-settings__muted">Настроек пока нет. Добавьте первую строку ниже.</p>
            ) : null}
            <ul className="acct-settings__list">
                {items.map((item) => (
                    <li key={item.key} className="acct-settings__row">
                        <span className="acct-settings__key">{item.key}</span>
                        <input
                            className="acct-settings__input"
                            value={item.value}
                            aria-label={item.key}
                            onChange={(e) => {
                                const value = e.target.value;
                                setItems((prev) => prev.map((row) => row.key === item.key ? { ...row, value } : row));
                            }}
                        />
                        <button type="button" className="acct-settings__btn" disabled={savingKey === item.key} onClick={() => save(item.key, item.value)}>
                            Сохранить
                        </button>
                        <button type="button" className="acct-settings__btn acct-settings__btn--quiet" disabled={savingKey === item.key} onClick={() => remove(item.key)}>
                            Удалить
                        </button>
                    </li>
                ))}
            </ul>
            <form
                className="acct-settings__row acct-settings__row--new"
                onSubmit={(e) => {
                    e.preventDefault();
                    save(draftKey, draftValue);
                }}
            >
                <input
                    className="acct-settings__input acct-settings__input--key"
                    placeholder="Ключ"
                    aria-label="Ключ новой настройки"
                    value={draftKey}
                    onChange={(e) => setDraftKey(e.target.value)}
                />
                <input
                    className="acct-settings__input"
                    placeholder="Значение"
                    aria-label="Значение новой настройки"
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                />
                <button type="submit" className="acct-settings__btn" disabled={Boolean(savingKey)}>
                    Добавить
                </button>
            </form>
        </section>
    );
}
