import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';
import { sanitizeHtml } from '@shared/lib/sanitizeHtml';
import { formatBytes } from '../lib/filesFormat';
import {
    archiveFolder,
    OFFICE_PREVIEW_LIMIT,
    parseCsv,
    previewKindOf,
    TEXT_HEAD_BYTES,
    type ArchiveListing,
    type EmailPreview,
} from '../lib/previewKinds';
import { Icon, saveBlob, useFm } from './fmShared';

const DocxView = lazy(() => import('./previewOffice').then((m) => ({ default: m.DocxView })));
const XlsxView = lazy(() => import('./previewOffice').then((m) => ({ default: m.XlsxView })));

export type PreviewSource = {
    key: string;
    name: string;
    sizeBytes: number;
    contentType: string;
    link: (options: { inline?: boolean }) => Promise<string>;
    blob: () => Promise<Blob>;
    head: (bytes: number) => Promise<Blob>;
    archive?: () => Promise<ArchiveListing>;
    entry?: (index: number, name: string, size: number) => PreviewSource;
    email?: () => Promise<EmailPreview>;
    emailAttachment?: (index: number) => Promise<Blob>;
};

function useAsync<T>(run: (() => Promise<T>) | null, deps: unknown[]): { data: T | null; error: string } {
    const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: '' });
    useEffect(() => {
        if (!run)
            return;
        let alive = true;
        setState({ data: null, error: '' });
        run().then(
            (data) => alive && setState({ data, error: '' }),
            (err: unknown) => alive && setState({ data: null, error: err instanceof Error ? err.message : String(err) }),
        );
        return () => {
            alive = false;
        };
    }, deps); // eslint-disable-line react-hooks/exhaustive-deps
    return state;
}

function Loading() {
    return <div className="fm-pv__loading" aria-busy="true"><span /><span /><span /></div>;
}

function Note({ children, action }: { children: ReactNode; action?: ReactNode }) {
    return (
        <div className="fm-pv__empty">
            <Icon name="eye" />
            <p>{children}</p>
            {action}
        </div>
    );
}

export function FilePreview({ source, onDownload }: { source: PreviewSource; onDownload?: () => void }) {
    const { tr } = useFm();
    const kind = previewKindOf(source.name, source.contentType);
    const download = onDownload ? <button type="button" className="fm-btn" onClick={onDownload}><Icon name="download" />{tr('preview.download')}</button> : undefined;
    if (!kind)
        return <Note action={download}>{tr('preview.none')}</Note>;
    if (kind === 'unsupported-archive')
        return <Note action={download}>{tr('preview.archiveFormat')}</Note>;
    if ((kind === 'docx' || kind === 'xlsx') && source.sizeBytes > OFFICE_PREVIEW_LIMIT)
        return <Note action={download}>{tr('preview.tooBig')}</Note>;
    switch (kind) {
        case 'pdf':
        case 'image':
        case 'video':
        case 'audio':
            return <MediaPreview source={source} kind={kind} />;
        case 'text':
        case 'csv':
            return <TextPreview source={source} csv={kind === 'csv'} />;
        case 'docx':
        case 'xlsx':
            return <OfficePreview source={source} kind={kind} />;
        case 'archive':
            return source.archive ? <ArchivePreview source={source} /> : <Note action={download}>{tr('preview.none')}</Note>;
        case 'email':
            return source.email ? <EmailView source={source} /> : <Note action={download}>{tr('preview.none')}</Note>;
        default:
            return <Note action={download}>{tr('preview.none')}</Note>;
    }
}

function MediaPreview({ source, kind }: { source: PreviewSource; kind: 'pdf' | 'image' | 'video' | 'audio' }) {
    const { tr } = useFm();
    const { data: url, error } = useAsync(() => source.link({ inline: true }), [source.key]);
    if (error)
        return <Note>{error}</Note>;
    if (!url)
        return <Loading />;
    if (kind === 'image')
        return <div className="fm-pv fm-pv--image"><img src={url} alt={source.name} /></div>;
    if (kind === 'video')
        return <div className="fm-pv fm-pv--media"><video src={url} controls preload="metadata">{tr('preview.none')}</video></div>;
    if (kind === 'audio')
        return <div className="fm-pv fm-pv--audio"><audio src={url} controls preload="metadata" /></div>;
    return <iframe className="fm-pv fm-pv--pdf" src={url} title={source.name} />;
}

function TextPreview({ source, csv }: { source: PreviewSource; csv: boolean }) {
    const { tr } = useFm();
    const { data: text, error } = useAsync(async () => {
        const blob = await source.head(TEXT_HEAD_BYTES);
        return await blob.text();
    }, [source.key]);
    const rows = useMemo(() => (csv && text != null ? parseCsv(text) : null), [csv, text]);
    if (error)
        return <Note>{error}</Note>;
    if (text == null)
        return <Loading />;
    const cut = source.sizeBytes > TEXT_HEAD_BYTES ? <p className="fm-pv__cut">{tr('preview.cut', { size: formatBytes(TEXT_HEAD_BYTES, 'ru') })}</p> : null;
    if (rows) {
        return (
            <div className="fm-pv fm-pv--sheet">
                <div className="fm-pv__table-wrap">
                    <table className="fm-pv__table">
                        <tbody>
                            {rows.map((row, r) => (
                                <tr key={r}>
                                    <th scope="row">{r + 1}</th>
                                    {row.map((cell, c) => <td key={c}>{cell}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {cut}
            </div>
        );
    }
    return <div className="fm-pv fm-pv--text"><pre>{text}</pre>{cut}</div>;
}

function OfficePreview({ source, kind }: { source: PreviewSource; kind: 'docx' | 'xlsx' }) {
    const { tr } = useFm();
    const { data: bytes, error } = useAsync(async () => new Uint8Array(await (await source.blob()).arrayBuffer()), [source.key]);
    if (error)
        return <Note>{error}</Note>;
    if (!bytes)
        return <Loading />;
    return (
        <div className="fm-pv fm-pv--office">
            <Suspense fallback={<Loading />}>
                {kind === 'docx' ? <DocxView bytes={bytes} title={source.name} /> : <XlsxView bytes={bytes} emptyText={tr('preview.emptySheet')} />}
            </Suspense>
        </div>
    );
}

function ArchivePreview({ source }: { source: PreviewSource }) {
    const { tr, locale } = useFm();
    const { data, error } = useAsync(() => source.archive!(), [source.key]);
    const [folder, setFolder] = useState('');
    const [filter, setFilter] = useState('');
    const [opened, setOpened] = useState<PreviewSource | null>(null);
    if (error)
        return <Note>{error}</Note>;
    if (!data)
        return <Loading />;
    if (!data.supported)
        return <Note>{data.reason || tr('preview.archiveBroken')}</Note>;
    if (opened) {
        return (
            <div className="fm-pv fm-pv--inner">
                <div className="fm-pv__bar">
                    <button type="button" className="fm-btn" onClick={() => setOpened(null)}><Icon name="back" />{tr('preview.backToArchive')}</button>
                    <strong title={opened.name}>{opened.name}</strong>
                    <button type="button" className="fm-btn" onClick={() => void opened.blob().then((blob) => saveBlob(blob, opened.name))}><Icon name="download" />{tr('preview.download')}</button>
                </div>
                <FilePreview source={opened} />
            </div>
        );
    }
    const needle = filter.trim().toLowerCase();
    const rows = needle
        ? data.entries.filter((entry) => !entry.dir && entry.path.toLowerCase().includes(needle)).map((entry) => ({
            name: entry.path, path: entry.path, dir: false, size: entry.size, entry, count: 0,
        }))
        : archiveFolder(data.entries, folder);
    const crumbs = folder ? folder.split('/') : [];
    const files = data.entries.filter((entry) => !entry.dir).length;
    return (
        <div className="fm-pv fm-pv--archive">
            <div className="fm-pv__bar">
                <nav className="fm-pv__crumbs" aria-label={tr('preview.archive')}>
                    <button type="button" onClick={() => setFolder('')}><Icon name="folderOpen" />{source.name}</button>
                    {crumbs.map((part, index) => (
                        <span key={index}>
                            <i aria-hidden>/</i>
                            <button type="button" onClick={() => setFolder(crumbs.slice(0, index + 1).join('/'))}>{part}</button>
                        </span>
                    ))}
                </nav>
                <input type="search" className="fm-pv__find" value={filter} placeholder={tr('preview.archiveSearch')} aria-label={tr('preview.archiveSearch')} onChange={(event) => setFilter(event.target.value)} />
            </div>
            <p className="fm-pv__meta">
                {tr('preview.archiveSummary', { files, size: formatBytes(data.uncompressed, locale) })}
                {data.truncated ? ` · ${tr('preview.archiveTruncated', { count: data.entries.length })}` : ''}
            </p>
            <ul className="fm-pv__list">
                {folder && !needle ? (
                    <li><button type="button" className="fm-pv__row" onClick={() => setFolder(crumbs.slice(0, -1).join('/'))}><Icon name="up" /><span>..</span></button></li>
                ) : null}
                {rows.map((row) => (
                    <li key={row.path}>
                        <button
                            type="button"
                            className="fm-pv__row"
                            disabled={Boolean(row.entry?.encrypted)}
                            title={row.entry?.encrypted ? tr('preview.encrypted') : row.path}
                            onClick={() => {
                                if (row.dir)
                                    setFolder(row.path);
                                else if (row.entry && source.entry)
                                    setOpened(source.entry(row.entry.index, row.name.split('/').pop() ?? row.name, row.entry.size));
                            }}
                        >
                            <Icon name={row.dir ? 'folder' : row.entry?.encrypted ? 'lock' : 'template'} />
                            <span className="fm-pv__name">{row.name}</span>
                            <span className="fm-pv__size">{row.dir ? tr('preview.archiveItems', { count: row.count }) : formatBytes(row.size, locale)}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function EmailView({ source }: { source: PreviewSource }) {
    const { tr, locale } = useFm();
    const { data, error } = useAsync(() => source.email!(), [source.key]);
    const html = useMemo(() => (data?.html ? sanitizeHtml(data.html) : ''), [data]);
    const [remoteAllowed, setRemoteAllowed] = useState(false);
    const hasRemote = useMemo(() => /\b(?:src|background)\s*=\s*["']?\s*https?:|url\(\s*["']?\s*https?:/i.test(html), [html]);
    if (error)
        return <Note>{error}</Note>;
    if (!data)
        return <Loading />;
    const field = (label: string, value: string) => (value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null);
    return (
        <div className="fm-pv fm-pv--email">
            <h4>{data.subject || tr('preview.noSubject')}</h4>
            <dl className="fm-pv__headers">
                {field(tr('preview.from'), data.from)}
                {field(tr('preview.to'), data.to)}
                {field(tr('preview.cc'), data.cc)}
                {field(tr('preview.date'), data.date)}
            </dl>
            {data.attachments.length ? (
                <ul className="fm-pv__attachments">
                    {data.attachments.map((item) => (
                        <li key={item.index}>
                            <button type="button" onClick={() => void source.emailAttachment?.(item.index).then((blob) => saveBlob(blob, item.name))}>
                                <Icon name="download" />
                                <span>{item.name}</span>
                                <em>{formatBytes(item.size, locale)}</em>
                            </button>
                        </li>
                    ))}
                </ul>
            ) : null}
            {html && hasRemote && !remoteAllowed ? (
                <p className="fm-pv__remote">
                    {tr('preview.remoteBlocked')}
                    <button type="button" className="fm-link" onClick={() => setRemoteAllowed(true)}>{tr('preview.showImages')}</button>
                </p>
            ) : null}
            {html ? (
                <iframe
                    key={remoteAllowed ? 'remote' : 'local'}
                    className="fm-pv__mail"
                    title={data.subject}
                    sandbox=""
                    referrerPolicy="no-referrer"
                    srcDoc={`<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data: cid:${remoteAllowed ? ' https:' : ''}"><base target="_blank"><style>body{font:14px/1.5 system-ui,sans-serif;margin:12px;color:#111;word-wrap:break-word}img{max-width:100%}</style>${html}`}
                />
            ) : <pre className="fm-pv__mailtext">{data.text}</pre>}
        </div>
    );
}
