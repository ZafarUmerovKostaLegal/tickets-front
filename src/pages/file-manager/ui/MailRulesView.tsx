import { useEffect, useMemo, useState } from 'react';
import { filesApi, type ClientsResponse, type FolderRow, type MailRule } from '../api/filesApi';
import { formatDateTime } from '../lib/filesFormat';
import { FmSelect, type FmSelectOption } from './fmSelect';
import { ConfirmModal, Icon, StateBlock, useAction, useFm, useLoad } from './fmShared';
import './MailRulesView.css';

type Draft = { id: string | null; match: string; subject: string; matterId: string; folderId: string; shared: boolean };

const EMPTY: Draft = { id: null, match: '', subject: '', matterId: '', folderId: '', shared: false };

function folderPaths(folders: FolderRow[]): FmSelectOption[] {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const pathOf = (folder: FolderRow): string => {
        const names: string[] = [];
        let cursor: FolderRow | undefined = folder;
        const seen = new Set<string>();
        while (cursor && !seen.has(cursor.id)) {
            seen.add(cursor.id);
            names.unshift(cursor.name);
            cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
        }
        return names.join(' / ');
    };
    return folders
        .map((folder) => ({ value: folder.id, label: pathOf(folder) }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

const GENERIC = new Set(['kostalegal.com', 'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com', 'me.com', 'yahoo.com', 'aol.com', 'proton.me', 'protonmail.com', 'mail.ru', 'inbox.ru', 'list.ru', 'bk.ru', 'yandex.ru', 'ya.ru', 'yandex.com', 'rambler.ru']);

function senderDomain(match: string): string {
    const value = match.trim().toLowerCase();
    const at = value.lastIndexOf('@');
    return at > 0 ? value.slice(at + 1) : '';
}

function isDomainMatch(match: string): boolean {
    const value = match.trim();
    return Boolean(value) && (!value.includes('@') || value.startsWith('@'));
}

function phrases(subject: string): string[] {
    return subject.split(/[,;\n]+/).map((part) => part.trim()).filter(Boolean);
}

export function MailRulesView({ clients }: { clients: ClientsResponse | null }) {
    const { tr, locale } = useFm();
    const act = useAction();
    const load = useLoad(() => filesApi.mailRules(), []);
    const [draft, setDraft] = useState<Draft>(EMPTY);
    const [busy, setBusy] = useState(false);
    const [remove, setRemove] = useState<MailRule | null>(null);
    const [folders, setFolders] = useState<FmSelectOption[] | null>(null);
    const data = load.data;
    const box = data?.mailbox ?? null;
    const editing = draft.id !== null;

    const matters = useMemo(() => (clients?.clients ?? []).flatMap((client) => client.matters
        .filter((matter) => !matter.closed && (matter.level === 'edit' || matter.level === 'manage') && (matter.mine || draft.shared || matter.id === draft.matterId))
        .map((matter) => ({ matter, client }))), [clients, draft.shared, draft.matterId]);
    const matterOptions = useMemo(() => matters
        .map(({ matter, client }) => ({ value: matter.id, label: `${matter.code ? `${matter.code} · ` : ''}${matter.name} — ${client.name}` }))
        .sort((a, b) => a.label.localeCompare(b.label, 'ru')), [matters]);
    const picked = matters.find(({ matter }) => matter.id === draft.matterId);

    useEffect(() => {
        setFolders(null);
        if (!draft.matterId)
            return;
        let alive = true;
        filesApi.browse(draft.matterId, null)
            .then((result) => {
                if (alive)
                    setFolders(folderPaths(result.folders));
            })
            .catch(() => {
                if (alive)
                    setFolders([]);
            });
        return () => {
            alive = false;
        };
    }, [draft.matterId]);

    const folderOptions = useMemo(() => [
        { value: '', label: tr('mailRulesX.defaultFolderOption') },
        ...(folders ?? []),
    ], [folders, tr]);
    const folderLabel = draft.folderId ? (folders ?? []).find((option) => option.value === draft.folderId)?.label ?? '' : tr('mailRules.defaultFolder');

    const toggleMailbox = async (enabled: boolean) => {
        setBusy(true);
        const ok = await act(() => filesApi.setAutofile(enabled), enabled ? tr('mailRules.autofileOn') : tr('mailRules.autofileOff'));
        setBusy(false);
        if (ok)
            load.reload();
    };

    const submit = async () => {
        setBusy(true);
        const folderId = draft.folderId || null;
        const ok = draft.id
            ? await act(() => filesApi.updateMailRule(draft.id as string, {
                match: draft.match, subject: draft.subject, matterId: draft.matterId,
                ...(folderId ? { folderId } : { clearFolder: true }),
            }), tr('mailRules.saved'))
            : await act(() => filesApi.createMailRule({
                match: draft.match, subject: draft.subject, matterId: draft.matterId, folderId, scope: draft.shared ? 'shared' : 'personal',
            }), tr('mailRules.saved'));
        setBusy(false);
        if (ok) {
            setDraft((prev) => ({ ...EMPTY, matterId: prev.id ? '' : prev.matterId, folderId: prev.id ? '' : prev.folderId, shared: prev.id ? false : prev.shared }));
            load.reload();
        }
    };

    const startEdit = (rule: MailRule) => {
        setDraft({ id: rule.id, match: rule.match, subject: rule.subject ?? '', matterId: rule.matterId, folderId: rule.folderId ?? '', shared: rule.scope === 'shared' });
        window.scrollTo?.({ top: 0, behavior: 'smooth' });
    };

    const hasCondition = Boolean(draft.match.trim() || draft.subject.trim());
    const ready = hasCondition && Boolean(draft.matterId) && !busy;
    const rules = data?.rules ?? [];
    const personal = rules.filter((rule) => rule.scope === 'personal');
    const common = rules.filter((rule) => rule.scope === 'shared');

    const renderRules = (rows: MailRule[], empty: string) => (rows.length ? (
        <ul className="fm-mr-list">
            {rows.map((rule) => {
                const words = phrases(rule.subject ?? '');
                return (
                    <li key={rule.id} className={`fm-mr-rule${rule.enabled ? '' : ' is-off'}${draft.id === rule.id ? ' is-editing' : ''}`}>
                        <div className="fm-mr-rule__when">
                            <span className={`fm-mr-chip fm-mr-chip--from${rule.match && isDomainMatch(rule.match) ? ' is-domain' : ''}`}
                                title={rule.match && isDomainMatch(rule.match) ? tr('mailRulesX.domainNote', { domain: rule.match }) : undefined}>
                                <Icon name={rule.match && isDomainMatch(rule.match) ? 'building' : 'user'} />
                                {!rule.match ? tr('mailRulesX.anySender') : isDomainMatch(rule.match) ? tr('mailRulesX.wholeDomain', { domain: rule.match.replace(/^@/, '') }) : rule.match}
                            </span>
                            {words.length ? (
                                <span className="fm-mr-chip fm-mr-chip--subject" title={tr('mailRulesX.subjectLabel')}>
                                    <Icon name="search" />
                                    {words.map((word, index) => <b key={word}>{index ? ` ${tr('mailRulesX.or')} ` : ''}«{word}»</b>)}
                                </span>
                            ) : null}
                        </div>
                        <span className="fm-mr-rule__arrow" aria-hidden>→</span>
                        <div className="fm-mr-rule__target">
                            <span>{rule.matterCode ? <em>{rule.matterCode}</em> : null}{rule.matterName}</span>
                            <small><Icon name="folder" />{rule.folderPath || tr('mailRules.defaultFolder')}<i>· {rule.clientName}</i></small>
                        </div>
                        <div className="fm-mr-rule__meta">
                            <span>{tr('mailRules.hits', { count: rule.hits })}</span>
                            {rule.lastHitAt ? <span>{formatDateTime(rule.lastHitAt, locale)}</span> : null}
                            {rule.scope === 'shared' && rule.ownerName ? <span>{tr('mailRules.by', { name: rule.ownerName })}</span> : null}
                        </div>
                        {rule.canEdit ? (
                            <div className="fm-mr-rule__actions">
                                <label className="fm-switch">
                                    <input type="checkbox" checked={rule.enabled} onChange={async (event) => {
                                        const ok = await act(() => filesApi.updateMailRule(rule.id, { enabled: event.target.checked }));
                                        if (ok)
                                            load.reload();
                                    }} />
                                    <span>{rule.enabled ? tr('mailRules.on') : tr('mailRules.off')}</span>
                                </label>
                                <button type="button" className="fm-btn fm-btn--ghost" aria-label={tr('mailRulesX.edit')} title={tr('mailRulesX.edit')} onClick={() => startEdit(rule)}>
                                    <Icon name="edit" />
                                </button>
                                <button type="button" className="fm-btn fm-btn--ghost" aria-label={tr('mailRules.remove')} title={tr('mailRules.remove')} onClick={() => setRemove(rule)}>
                                    <Icon name="trash" />
                                </button>
                            </div>
                        ) : null}
                    </li>
                );
            })}
        </ul>
    ) : <p className="fm-muted">{empty}</p>);

    return (
        <section className="fm-docs fm-docs--padded fm-mailrules">
            <p className="fm-hint">{tr('mailRulesX.hint')}</p>
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

                        <form className={`fm-mr-form${editing ? ' is-editing' : ''}`} onSubmit={(event) => { event.preventDefault(); if (ready) void submit(); }}>
                            <h3>{editing ? tr('mailRulesX.editTitle') : tr('mailRulesX.newTitle')}</h3>
                            <div className="fm-mr-form__grid">
                                <label>
                                    <span>{tr('mailRulesX.fromLabel')}</span>
                                    <input className="fm-input" value={draft.match} placeholder={tr('mailRulesX.fromPlaceholder')}
                                        onChange={(event) => setDraft((prev) => ({ ...prev, match: event.target.value }))} />
                                    {senderDomain(draft.match) && !GENERIC.has(senderDomain(draft.match)) ? (
                                        <button type="button" className="fm-mr-domain" onClick={() => setDraft((prev) => ({ ...prev, match: `@${senderDomain(prev.match)}` }))}>
                                            <Icon name="building" />{tr('mailRulesX.useDomain', { domain: senderDomain(draft.match) })}
                                        </button>
                                    ) : isDomainMatch(draft.match) ? (
                                        <small className="fm-mr-domain-note"><Icon name="building" />{tr('mailRulesX.domainNote', { domain: draft.match.trim().replace(/^@/, '') })}</small>
                                    ) : null}
                                </label>
                                <label>
                                    <span>{tr('mailRulesX.subjectLabel')}</span>
                                    <input className="fm-input" value={draft.subject} placeholder={tr('mailRulesX.subjectPlaceholder')}
                                        onChange={(event) => setDraft((prev) => ({ ...prev, subject: event.target.value }))} />
                                </label>
                                <label>
                                    <span>{tr('mailRules.to')}</span>
                                    <FmSelect value={draft.matterId} options={matterOptions} placeholder={tr('mailRules.pickMatter')}
                                        onChange={(next) => setDraft((prev) => ({ ...prev, matterId: next, folderId: '' }))} />
                                </label>
                                <label>
                                    <span>{tr('mailRulesX.folderLabel')}</span>
                                    <FmSelect value={draft.folderId} options={folderOptions} disabled={!draft.matterId || folders === null}
                                        placeholder={draft.matterId && folders === null ? tr('common.loading') : tr('mailRulesX.pickMatterFirst')}
                                        onChange={(next) => setDraft((prev) => ({ ...prev, folderId: next }))} />
                                </label>
                            </div>
                            <p className={`fm-mr-form__summary${hasCondition && draft.matterId ? '' : ' is-muted'}`}>
                                {hasCondition && draft.matterId
                                    ? tr('mailRulesX.summary', {
                                        from: draft.match.trim() || tr('mailRulesX.anySenderLower'),
                                        subject: phrases(draft.subject).length ? tr('mailRulesX.summarySubject', { words: phrases(draft.subject).map((word) => `«${word}»`).join(` ${tr('mailRulesX.or')} `) }) : '',
                                        matter: picked ? `${picked.matter.code ? `${picked.matter.code} · ` : ''}${picked.matter.name}` : '',
                                        folder: folderLabel,
                                    })
                                    : tr('mailRulesX.needCondition')}
                            </p>
                            <div className="fm-mr-form__foot">
                                {data.canShare && !editing ? (
                                    <label className="fm-check">
                                        <input type="checkbox" checked={draft.shared} onChange={(event) => setDraft((prev) => ({ ...prev, shared: event.target.checked }))} />
                                        <span>{tr('mailRules.shared')}</span>
                                    </label>
                                ) : <span />}
                                <div className="fm-mr-form__buttons">
                                    {editing ? (
                                        <button type="button" className="fm-btn" onClick={() => setDraft(EMPTY)}>{tr('common.cancel')}</button>
                                    ) : null}
                                    <button type="submit" className="fm-btn fm-btn--primary" disabled={!ready}>
                                        <Icon name={editing ? 'check' : 'plus'} />{editing ? tr('mailRulesX.saveEdit') : tr('mailRules.add')}
                                    </button>
                                </div>
                            </div>
                        </form>

                        <p className="fm-mr-order">{tr('mailRulesX.order')}</p>
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
                    text={tr('mailRules.removeConfirm', { match: [remove.match, remove.subject].filter(Boolean).join(' · ') })}
                    confirmLabel={tr('mailRules.remove')}
                    danger
                    onClose={() => setRemove(null)}
                    onConfirm={async () => {
                        const ok = await act(() => filesApi.deleteMailRule(remove.id));
                        if (ok) {
                            if (draft.id === remove.id)
                                setDraft(EMPTY);
                            load.reload();
                        }
                    }}
                />
            ) : null}
        </section>
    );
}
