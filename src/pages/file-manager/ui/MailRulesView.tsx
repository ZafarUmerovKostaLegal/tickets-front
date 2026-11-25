import { useMemo, useState } from 'react';
import { filesApi, type ClientsResponse, type MailRule } from '../api/filesApi';
import { formatDateTime } from '../lib/filesFormat';
import { FmSelect } from './fmSelect';
import { ConfirmModal, Icon, StateBlock, useAction, useFm, useLoad } from './fmShared';

export function MailRulesView({ clients }: { clients: ClientsResponse | null }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.mailRules(), []);
    const [match, setMatch] = useState('');
    const [matterId, setMatterId] = useState('');
    const [shared, setShared] = useState(false);
    const [busy, setBusy] = useState(false);
    const [remove, setRemove] = useState<MailRule | null>(null);
    const data = load.data;
    const box = data?.mailbox ?? null;

    const matterOptions = useMemo(() => (clients?.clients ?? []).flatMap((client) => client.matters
        .filter((matter) => !matter.closed && (matter.level === 'edit' || matter.level === 'manage') && (matter.mine || shared))
        .map((matter) => ({
            value: matter.id,
            label: `${matter.code ? `${matter.code} · ` : ''}${matter.name} — ${client.name}`,
        })))
        .sort((a, b) => a.label.localeCompare(b.label, 'ru')), [clients, shared]);

    const toggleMailbox = async (enabled: boolean) => {
        setBusy(true);
        const ok = await act(() => filesApi.setAutofile(enabled), enabled ? tr('mailRules.autofileOn') : tr('mailRules.autofileOff'));
        setBusy(false);
        if (ok)
            load.reload();
    };

    const add = async () => {
        setBusy(true);
        const ok = await act(() => filesApi.createMailRule({ match, matterId, scope: shared ? 'shared' : 'personal' }), tr('mailRules.saved'));
        setBusy(false);
        if (ok) {
            setMatch('');
            load.reload();
        }
    };

    const rules = data?.rules ?? [];
    const personal = rules.filter((rule) => rule.scope === 'personal');
    const common = rules.filter((rule) => rule.scope === 'shared');

    const renderRules = (rows: MailRule[], empty: string) => (rows.length ? (
        <ul className="fm-mailrules__list">
            {rows.map((rule) => (
                <li key={rule.id} className={rule.enabled ? undefined : 'is-off'}>
                    <div className="fm-mailrules__rule">
                        <strong>{rule.match.includes('@') ? rule.match : `@${rule.match}`}</strong>
                        <span className="fm-mailrules__arrow" aria-hidden>→</span>
                        <span className="fm-mailrules__target">
                            {rule.matterCode ? <em>{rule.matterCode}</em> : null}
                            {rule.matterName}
                            <small>{rule.clientName}{rule.folderPath ? ` · ${rule.folderPath}` : ` · ${tr('mailRules.defaultFolder')}`}</small>
                        </span>
                    </div>
                    <div className="fm-mailrules__meta">
                        <span>{tr('mailRules.hits', { count: rule.hits })}{rule.lastHitAt ? ` · ${formatDateTime(rule.lastHitAt, locale)}` : ''}</span>
                        {rule.scope === 'shared' && rule.ownerName ? <span>{tr('mailRules.by', { name: rule.ownerName })}</span> : null}
                    </div>
                    {rule.canEdit ? (
                        <div className="fm-mailrules__actions">
                            <label className="fm-switch">
                                <input
                                    type="checkbox"
                                    checked={rule.enabled}
                                    onChange={async (event) => {
                                        const ok = await act(() => filesApi.updateMailRule(rule.id, { enabled: event.target.checked }));
                                        if (ok)
                                            load.reload();
                                    }}
                                />
                                <span>{rule.enabled ? tr('mailRules.on') : tr('mailRules.off')}</span>
                            </label>
                            <button type="button" className="fm-btn fm-btn--ghost" aria-label={tr('mailRules.remove')} title={tr('mailRules.remove')} onClick={() => setRemove(rule)}>
                                <Icon name="trash" />
                            </button>
                        </div>
                    ) : null}
                </li>
            ))}
        </ul>
    ) : <p className="fm-muted">{empty}</p>);

    return (
        <section className="fm-docs fm-docs--padded fm-mailrules">
            <p className="fm-hint">{tr('mailRules.hint')}</p>
            <StateBlock loading={load.loading && !data} error={load.error} onRetry={load.reload}>
                {data ? (
                    <>
                        <div className={`fm-mailrules__box${box?.enabled ? ' is-on' : ''}`}>
                            <div>
                                <strong>{tr('mailRules.autofileTitle')}</strong>
                                <p>
                                    {box?.enabled
                                        ? tr('mailRules.autofileStatus', {
                                            email: box.email,
                                            count: box.filedTotal,
                                            when: box.lastRunAt ? formatDateTime(box.lastRunAt, locale) : '—',
                                        })
                                        : tr('mailRules.autofileHint')}
                                </p>
                                {!data.serverReady ? <p className="fm-mailrules__error">{tr('mailRules.serverOff')}</p> : null}
                            </div>
                            <button type="button" className={`fm-btn${box?.enabled ? '' : ' fm-btn--primary'}`} disabled={busy} onClick={() => void toggleMailbox(!box?.enabled)}>
                                {box?.enabled ? tr('mailRules.turnOff') : tr('mailRules.turnOn')}
                            </button>
                        </div>

                        <form className="fm-mailrules__form" onSubmit={(event) => { event.preventDefault(); void add(); }}>
                            <label>
                                <span>{tr('mailRules.from')}</span>
                                <input className="fm-input" value={match} placeholder="ivan@client.com или client.com" onChange={(event) => setMatch(event.target.value)} />
                            </label>
                            <label className="fm-mailrules__matter">
                                <span>{tr('mailRules.to')}</span>
                                <FmSelect value={matterId} options={matterOptions} placeholder={tr('mailRules.pickMatter')} onChange={setMatterId} />
                            </label>
                            {data.canShare ? (
                                <label className="fm-check">
                                    <input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} />
                                    <span>{tr('mailRules.shared')}</span>
                                </label>
                            ) : null}
                            <button type="submit" className="fm-btn fm-btn--primary" disabled={busy || !match.trim() || !matterId}>
                                <Icon name="plus" />{tr('mailRules.add')}
                            </button>
                        </form>

                        <h3 className="fm-mailrules__title">{tr('mailRules.personal')}</h3>
                        {renderRules(personal, tr('mailRules.noPersonal'))}
                        <h3 className="fm-mailrules__title">{tr('mailRules.common')}</h3>
                        {renderRules(common, tr('mailRules.noCommon'))}
                    </>
                ) : null}
            </StateBlock>
            {remove ? (
                <ConfirmModal
                    title={tr('mailRules.remove')}
                    text={tr('mailRules.removeConfirm', { match: remove.match })}
                    confirmLabel={tr('mailRules.remove')}
                    danger
                    onClose={() => setRemove(null)}
                    onConfirm={async () => {
                        const ok = await act(() => filesApi.deleteMailRule(remove.id));
                        if (ok)
                            load.reload();
                    }}
                />
            ) : null}
        </section>
    );
}
