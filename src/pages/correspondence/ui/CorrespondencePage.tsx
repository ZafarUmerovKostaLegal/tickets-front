import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { InvoiceCoverLetterModel } from '@pages/invoice-preview/lib/invoiceCoverLetterModel';
import { CorrespondenceLetterPreview } from './CorrespondenceLetterPreview';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { CorrespondenceRegistryView } from './CorrespondenceRegistryView';
import { CorrespondenceShell, type CorrespondenceNavTab } from './CorrespondenceShell';
import { coverModelToMockLetter, mockLetterToCoverModel } from '../lib/correspondenceCoverLetterModel';
import type { MockLetterCoverMeta } from '../lib/correspondenceCoverLetterModel';
import {
    CorrespondenceScreenSkeleton,
} from './CorrespondenceSkeleton';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';

export type DocType = 'letter' | 'contract' | 'note';
export type LetterStatus = 'draft' | 'pending_review' | 'rejected' | 'approved';

export type MockAttachment = { id: string; name: string; size: string };

export type { MockLetterCoverMeta } from '../lib/correspondenceCoverLetterModel';

export type MockLetter = {
    id: string;
    docType: DocType;
    subject: string;
    body: string;
    counterparty: string;
    date: string;
    status: LetterStatus;
    partnerId?: number;
    partnerName?: string;
    rejectionReason?: string;
    registryNumber: string;
    attachments: MockAttachment[];
    coverMeta?: MockLetterCoverMeta;
};

export type MockPartner = { id: number; name: string; position: string };

type CorrespondenceMainTab = 'incoming' | 'outgoing';

const CORRESPONDENCE_TAB_LABELS: Record<CorrespondenceMainTab, string> = {
    incoming: 'Входящие',
    outgoing: 'Исходящие',
};

type Screen =
    | { kind: 'incoming' }
    | { kind: 'outgoing' }
    | { kind: 'compose'; docType: DocType; editId?: string }
    | { kind: 'preview'; letterId: string }
    | { kind: 'partner-review'; letterId: string };

const LOAD_MS = 420;

function screenKey(screen: Screen): string {
    switch (screen.kind) {
        case 'compose':
            return `${screen.kind}-${screen.docType}${screen.editId ? `-${screen.editId}` : ''}`;
        case 'preview':
        case 'partner-review':
            return `${screen.kind}-${screen.letterId}`;
        default:
            return screen.kind;
    }
}

function useScreenTransition(initial: Screen) {
    const [screen, setScreen] = useState(initial);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        timerRef.current = setTimeout(() => setLoading(false), LOAD_MS);
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, []);

    const navigate = useCallback((next: Screen) => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        setScreen(next);
        setLoading(true);
        timerRef.current = setTimeout(() => setLoading(false), LOAD_MS);
    }, []);

    return { screen, loading, navigate };
}

export const MOCK_PARTNERS: MockPartner[] = [
    { id: 1, name: 'Иванов Иван Иванович', position: 'Старший партнёр' },
    { id: 2, name: 'Петрова Анна Сергеевна', position: 'Партнёр' },
    { id: 3, name: 'Сидоров Михаил Владимирович', position: 'Партнёр' },
    { id: 4, name: 'Козлова Елена Дмитриевна', position: 'Партнёр' },
];

const INITIAL_LETTERS: MockLetter[] = [
    {
        id: 'l1', docType: 'letter',
        subject: 'Запрос документов для проведения due diligence',
        body: 'Уважаемые коллеги,\n\nВ рамках подготовки к сделке просим вас предоставить следующий пакет документов до 25 июня 2026 г.:\n\n1. Устав компании в актуальной редакции\n2. Свидетельство о государственной регистрации\n3. Выписка из ЕГРЮЛ (не старше 30 дней)\n4. Бухгалтерский баланс за последние 2 года\n\nПросим подтвердить получение настоящего запроса.',
        counterparty: 'ООО "ТехноПром"', date: '2026-06-10', status: 'approved',
        partnerId: 1, partnerName: 'Иванов Иван Иванович',
        registryNumber: 'ИСХ-2026/001',
        attachments: [{ id: 'a1', name: 'перечень_документов.pdf', size: '84 КБ' }],
    },
    {
        id: 'l2', docType: 'letter',
        subject: 'Уведомление об изменении реквизитов',
        body: 'Уважаемые партнёры,\n\nИнформируем вас об изменении банковских реквизитов нашей компании с 01 июля 2026 г. Просим учесть новые реквизиты при осуществлении платежей.\n\nНовые реквизиты прилагаются.',
        counterparty: 'АО "СтройГрупп"', date: '2026-06-14', status: 'rejected',
        partnerId: 2, partnerName: 'Петрова Анна Сергеевна',
        rejectionReason: 'Необходимо добавить дату вступления в силу новых реквизитов и приложить официальное письмо от банка.',
        registryNumber: 'ИСХ-2026/002',
        attachments: [{ id: 'a2', name: 'новые_реквизиты.pdf', size: '45 КБ' }],
    },
    {
        id: 'l3', docType: 'letter',
        subject: 'Коммерческое предложение по юридическому сопровождению',
        body: 'Уважаемые коллеги,\n\nПредставляем вашему вниманию коммерческое предложение по комплексному юридическому сопровождению деятельности вашей компании.',
        counterparty: 'ООО "Инновации"', date: '2026-06-17', status: 'pending_review',
        partnerId: 3, partnerName: 'Сидоров Михаил Владимирович',
        registryNumber: 'ИСХ-2026/003', attachments: [],
    },
    {
        id: 'l4', docType: 'letter',
        subject: '', body: '', counterparty: '', date: '2026-06-17', status: 'draft',
        registryNumber: 'ИСХ-2026/004', attachments: [],
    },
    {
        id: 'c1', docType: 'contract',
        subject: 'Договор на оказание юридических услуг №ЮУ-2026/15',
        body: 'г. Ташкент\n\n«Kosta Legal», именуемое в дальнейшем «Исполнитель», в лице управляющего партнёра, с одной стороны, и ООО «БизнесПлюс», именуемое в дальнейшем «Заказчик», с другой стороны, заключили настоящий Договор о нижеследующем:\n\n1. Предмет договора\n1.1. Исполнитель обязуется оказывать юридические услуги...',
        counterparty: 'ООО "БизнесПлюс"', date: '2026-06-12', status: 'approved',
        partnerId: 1, partnerName: 'Иванов Иван Иванович',
        registryNumber: 'ДОГ-2026/001',
        attachments: [{ id: 'a3', name: 'договор_юу_2026_15.pdf', size: '312 КБ' }],
    },
    {
        id: 'n1', docType: 'note',
        subject: 'Служебная записка о командировке',
        body: 'Прошу разрешить командировку в г. Алматы с 25 по 27 июня 2026 г. для участия в конференции «Корпоративное право — 2026».\n\nЦель: повышение квалификации, установление деловых контактов.\nОжидаемые расходы: проезд — 450 000 сум, проживание — 800 000 сум.',
        counterparty: 'Руководству', date: '2026-06-16', status: 'pending_review',
        partnerId: 2, partnerName: 'Петрова Анна Сергеевна',
        registryNumber: 'СЗ-2026/001', attachments: [],
    },
];

export const DOC_TYPE_META: Record<DocType, { label: string; plural: string; writeLabel: string; color: string }> = {
    letter: { label: 'Письмо', plural: 'Письма', writeLabel: 'Написать письмо', color: 'blue' },
    contract: { label: 'Договор', plural: 'Договоры', writeLabel: 'Создать договор', color: 'green' },
    note: { label: 'Служебная записка', plural: 'Служебные записки', writeLabel: 'Написать записку', color: 'purple' },
};

export const STATUS_META: Record<LetterStatus, { label: string; cls: string }> = {
    draft: { label: 'Черновик', cls: 'corr-n__badge--draft' },
    pending_review: { label: 'На проверке', cls: 'corr-n__badge--pending' },
    rejected: { label: 'Отклонено', cls: 'corr-n__badge--rejected' },
    approved: { label: 'Подтверждено', cls: 'corr-n__badge--approved' },
};

export function formatDateRu(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function nextRegistryNum(letters: MockLetter[], docType: DocType): string {
    const year = new Date().getFullYear();
    const prefix = docType === 'letter' ? 'ИСХ' : docType === 'contract' ? 'ДОГ' : 'СЗ';
    const nums = letters
        .filter(l => l.docType === docType)
        .map(l => { const m = l.registryNumber.match(/\/(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
    return `${prefix}-${year}/${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
}

export function IcoMailWrite() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
        <polyline points="22,6 12,13 2,6"/>
    </svg>);
}
export function IcoContract() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>);
}
export function IcoNote() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>);
}
export function IcoInbox() {
    return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/>
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>);
}
export function IcoPlus() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>);
}
export function IcoChevRight() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="9 18 15 12 9 6"/>
    </svg>);
}
export function IcoPaperclip() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
    </svg>);
}
export function IcoAlert() {
    return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>);
}
export function IcoEye() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>);
}
export function IcoCheck() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <polyline points="20 6 9 17 4 12"/>
    </svg>);
}
export function IcoCross() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>);
}
export function IcoSend() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>);
}
export function IcoEdit() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>);
}

function SendToPartnerModal({ onClose, onSend }: {
    onClose: () => void;
    onSend: (partner: MockPartner) => void;
}) {
    const [selected, setSelected] = useState<MockPartner | null>(null);
    const [comment, setComment] = useState('');
    return (
        <div className="corr-n__modal-backdrop" onClick={onClose}>
            <div className="corr-n__modal-panel" role="dialog" aria-modal aria-label="Отправить на проверку" onClick={e => e.stopPropagation()}>
                <div className="corr-n__modal-header">
                    <h3 className="corr-n__modal-title">Отправить на проверку</h3>
                    <button type="button" className="corr-n__modal-close" onClick={onClose} aria-label="Закрыть">
                        <IcoCross />
                    </button>
                </div>
                <div className="corr-n__modal-body">
                    <p className="corr-n__modal-hint">Выберите партнёра, который будет проверять документ:</p>
                    <div className="corr-n__partner-list">
                        {MOCK_PARTNERS.map(p => (
                            <button key={p.id} type="button"
                                className={`corr-n__partner-item${selected?.id === p.id ? ' corr-n__partner-item--on' : ''}`}
                                onClick={() => setSelected(p)}>
                                <div className="corr-n__partner-avatar">{p.name[0]}</div>
                                <div className="corr-n__partner-info">
                                    <span className="corr-n__partner-name">{p.name}</span>
                                    <span className="corr-n__partner-pos">{p.position}</span>
                                </div>
                                {selected?.id === p.id && <span className="corr-n__partner-check"><IcoCheck /></span>}
                            </button>
                        ))}
                    </div>
                    <div className="corr-n__form-field" style={{ marginTop: '1rem' }}>
                        <label className="corr-n__form-label">
                            Комментарий <span className="corr-n__form-hint">(необязательно)</span>
                        </label>
                        <textarea className="corr-n__textarea corr-n__textarea--sm" rows={3}
                            placeholder="Что нужно проверить..." value={comment}
                            onChange={e => setComment(e.target.value)} />
                    </div>
                </div>
                <div className="corr-n__modal-footer">
                    <button type="button" className="corr-n__btn-secondary" onClick={onClose}>Отмена</button>
                    <button type="button" className="corr-n__btn-primary" disabled={!selected}
                        onClick={() => selected && onSend(selected)}>
                        <IcoSend /> Отправить на проверку
                    </button>
                </div>
            </div>
        </div>
    );
}

function RejectModal({ onClose, onReject }: {
    onClose: () => void;
    onReject: (reason: string) => void;
}) {
    const [reason, setReason] = useState('');
    return (
        <div className="corr-n__modal-backdrop" onClick={onClose}>
            <div className="corr-n__modal-panel" role="dialog" aria-modal aria-label="Причина отклонения" onClick={e => e.stopPropagation()}>
                <div className="corr-n__modal-header">
                    <h3 className="corr-n__modal-title">Причина отклонения</h3>
                    <button type="button" className="corr-n__modal-close" onClick={onClose} aria-label="Закрыть">
                        <IcoCross />
                    </button>
                </div>
                <div className="corr-n__modal-body">
                    <p className="corr-n__modal-hint">Опишите, что нужно исправить или изменить в документе:</p>
                    <textarea className="corr-n__textarea" rows={5} autoFocus
                        placeholder="Укажите замечания к документу..."
                        value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <div className="corr-n__modal-footer">
                    <button type="button" className="corr-n__btn-secondary" onClick={onClose}>Отмена</button>
                    <button type="button" className="corr-n__btn-danger" disabled={!reason.trim()}
                        onClick={() => reason.trim() && onReject(reason.trim())}>
                        <IcoCross /> Отклонить
                    </button>
                </div>
            </div>
        </div>
    );
}

function buildCorrespondenceNavTabs(
    active: CorrespondenceMainTab,
    onNavigate: (screen: Screen) => void,
): CorrespondenceNavTab[] {
    return (['incoming', 'outgoing'] as CorrespondenceMainTab[]).map((tab) => ({
        id: tab,
        label: CORRESPONDENCE_TAB_LABELS[tab],
        active: active === tab,
        onClick: () => onNavigate({ kind: tab }),
    }));
}

function MailboxView({ tab, onNavigate }: {
    tab: CorrespondenceMainTab;
    onNavigate: (screen: Screen) => void;
}) {
    return (
        <CorrespondenceShell
            activeTab={CORRESPONDENCE_TAB_LABELS[tab]}
            tabs={buildCorrespondenceNavTabs(tab, onNavigate)}
        />
    );
}

function LetterComposeView({ editingLetter, letters, loading, onBack, onPreview }: {
    editingLetter?: MockLetter;
    letters: MockLetter[];
    loading?: boolean;
    onBack: () => void;
    onPreview: (letter: MockLetter) => void;
}) {
    const [subject, setSubject] = useState(editingLetter?.subject ?? '');
    const [coverModel, setCoverModel] = useState<InvoiceCoverLetterModel>(() =>
        mockLetterToCoverModel(editingLetter ?? {
            body: '',
            counterparty: '',
            date: new Date().toISOString().slice(0, 10),
        }),
    );
    const [attachments, setAttachments] = useState<MockAttachment[]>(editingLetter?.attachments ?? []);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingLetter) {
            setSubject(editingLetter.subject);
            setCoverModel(mockLetterToCoverModel(editingLetter));
            setAttachments(editingLetter.attachments);
        }
    }, [editingLetter?.id]);

    const patchCoverModel = useCallback((patch: Partial<InvoiceCoverLetterModel>) => {
        setCoverModel((prev) => ({ ...prev, ...patch }));
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setAttachments(prev => [...prev, ...files.map(f => ({
            id: generateId(),
            name: f.name,
            size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} МБ` : `${Math.round(f.size / 1024)} КБ`,
        }))]);
        e.target.value = '';
    };

    const draftLetter: MockLetter = coverModelToMockLetter(coverModel, {
        id: editingLetter?.id ?? generateId(),
        docType: 'letter',
        subject: subject.trim() || '(без темы)',
        date: editingLetter?.date ?? new Date().toISOString().slice(0, 10),
        status: editingLetter?.status === 'rejected' ? 'draft' : (editingLetter?.status ?? 'draft'),
        registryNumber: editingLetter?.registryNumber ?? nextRegistryNum(letters, 'letter'),
        attachments,
        partnerId: editingLetter?.status === 'rejected' ? undefined : editingLetter?.partnerId,
        partnerName: editingLetter?.status === 'rejected' ? undefined : editingLetter?.partnerName,
        rejectionReason: editingLetter?.rejectionReason,
    }) as MockLetter;

    const handlePreview = () => {
        if (!subject.trim())
            return;
        onPreview(draftLetter);
    };

    return (
        <>
            {editingLetter?.status === 'rejected' && editingLetter.rejectionReason && !loading && (
                <div className="corr-doc-preview__banner-wrap">
                    <div className="corr-n__banner corr-n__banner--rejected">
                        <div className="corr-n__banner-icon"><IcoAlert /></div>
                        <div>
                            <div className="corr-n__banner-title">
                                Причина отклонения{editingLetter.partnerName ? ` — ${editingLetter.partnerName}` : ''}
                            </div>
                            <div className="corr-n__banner-text">{editingLetter.rejectionReason}</div>
                        </div>
                    </div>
                </div>
            )}
            <CorrespondenceLetterWorkspace
                letter={draftLetter}
                coverModel={coverModel}
                editable
                onCoverModelChange={patchCoverModel}
                loading={loading}
                navbarTab="compose"
                onBack={onBack}
                toolbarSubject={(
                    <label className="corr-doc-preview__subject-field">
                        <span className="corr-doc-preview__subject-label">Тема</span>
                        <input
                            type="text"
                            className="corr-doc-preview__subject-input"
                            placeholder="Краткое описание письма"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                        />
                    </label>
                )}
                navbarActions={(
                    <>
                        <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                        <button type="button" className="corr-n__btn-secondary" onClick={() => fileRef.current?.click()} title="Прикрепить файл">
                            <IcoPaperclip /> <span>Вложения{attachments.length > 0 ? ` (${attachments.length})` : ''}</span>
                        </button>
                        <button type="button" className="corr-n__btn-secondary" onClick={onBack}>Отмена</button>
                        <button type="button" className="corr-n__btn-primary" disabled={!subject.trim()} onClick={handlePreview}>
                            <IcoEye /> Предпросмотр
                        </button>
                    </>
                )}
            />
        </>
    );
}

function GenericComposeView({ docType, editingLetter, letters, loading, onBack, onPreview }: {
    docType: 'contract' | 'note';
    editingLetter?: MockLetter;
    letters: MockLetter[];
    loading?: boolean;
    onBack: () => void;
    onPreview: (letter: MockLetter) => void;
}) {
    const meta = DOC_TYPE_META[docType];
    const [counterparty, setCounterparty] = useState(editingLetter?.counterparty ?? '');
    const [subject, setSubject] = useState(editingLetter?.subject ?? '');
    const [body, setBody] = useState(editingLetter?.body ?? '');
    const [attachments, setAttachments] = useState<MockAttachment[]>(editingLetter?.attachments ?? []);
    const fileRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        setAttachments(prev => [...prev, ...files.map(f => ({
            id: generateId(),
            name: f.name,
            size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} МБ` : `${Math.round(f.size / 1024)} КБ`,
        }))]);
        e.target.value = '';
    };

    const autoGrow = () => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    const handlePreview = () => {
        const letter: MockLetter = {
            id: editingLetter?.id ?? generateId(),
            docType,
            subject: subject.trim() || '(без темы)',
            body,
            counterparty: counterparty.trim(),
            date: editingLetter?.date ?? new Date().toISOString().slice(0, 10),
            status: editingLetter?.status === 'rejected' ? 'draft' : (editingLetter?.status ?? 'draft'),
            partnerId: editingLetter?.status === 'rejected' ? undefined : editingLetter?.partnerId,
            partnerName: editingLetter?.status === 'rejected' ? undefined : editingLetter?.partnerName,
            registryNumber: editingLetter?.registryNumber ?? nextRegistryNum(letters, docType),
            attachments,
        };
        onPreview(letter);
    };

    const composeLabel = editingLetter ? 'Редактирование' : meta.writeLabel;

    return (
        <CorrespondenceShell
            activeTab={composeLabel}
            onBack={onBack}
            actions={!loading ? (
                <>
                    <button type="button" className="corr-n__btn-secondary" onClick={onBack}>Отмена</button>
                    <button type="button" className="corr-n__btn-primary" disabled={!subject.trim()} onClick={handlePreview}>
                        <IcoEye /> Предпросмотр
                    </button>
                </>
            ) : undefined}
        >
            {loading ? <CorrespondenceScreenSkeleton kind="compose" /> : (
                <div className="corr-shell__content--narrow">
                    {editingLetter?.status === 'rejected' && editingLetter.rejectionReason && (
                        <div className="corr-shell__alert corr-n__banner corr-n__banner--rejected">
                            <div className="corr-n__banner-icon"><IcoAlert /></div>
                            <div>
                                <div className="corr-n__banner-title">
                                    Причина отклонения{editingLetter.partnerName ? ` — ${editingLetter.partnerName}` : ''}
                                </div>
                                <div className="corr-n__banner-text">{editingLetter.rejectionReason}</div>
                            </div>
                        </div>
                    )}
                    <div className="corr-shell__compose-panel">
                        <div className="corr-n__form-field">
                            <label className="corr-n__form-label">
                                Кому <span className="corr-n__form-hint">(получатель)</span>
                            </label>
                            <input type="text" className="corr-n__input"
                                placeholder='Например: ООО "Партнёр" или Руководству'
                                value={counterparty} onChange={e => setCounterparty(e.target.value)} />
                        </div>
                        <div className="corr-n__form-field">
                            <label className="corr-n__form-label">
                                Тема <span className="corr-n__form-required">*</span>
                            </label>
                            <input type="text" className="corr-n__input"
                                placeholder="Краткое описание документа"
                                value={subject} onChange={e => setSubject(e.target.value)} />
                        </div>
                        <div className="corr-n__form-field corr-n__form-field--body">
                            <label className="corr-n__form-label">Текст документа</label>
                            <textarea ref={textareaRef} className="corr-n__textarea" rows={14}
                                placeholder={`Введите текст ${docType === 'contract' ? 'договора' : 'записки'}…`}
                                value={body}
                                onChange={e => { setBody(e.target.value); autoGrow(); }}
                                onInput={autoGrow} />
                        </div>
                        <div className="corr-n__form-field">
                            <label className="corr-n__form-label">Вложения</label>
                            <input ref={fileRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileChange} />
                            {attachments.length > 0 && (
                                <div className="corr-n__attach-list">
                                    {attachments.map(a => (
                                        <div key={a.id} className="corr-n__attach-item">
                                            <IcoPaperclip />
                                            <span className="corr-n__attach-name">{a.name}</span>
                                            <span className="corr-n__attach-size">{a.size}</span>
                                            <button type="button" className="corr-n__attach-rm"
                                                onClick={() => setAttachments(p => p.filter(x => x.id !== a.id))}
                                                aria-label={`Удалить ${a.name}`}>
                                                <IcoCross />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button type="button" className="corr-n__btn-attach" onClick={() => fileRef.current?.click()}>
                                <IcoPaperclip /> Прикрепить файл
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </CorrespondenceShell>
    );
}

function ComposeView({ docType, editingLetter, letters, loading, onBack, onPreview }: {
    docType: DocType;
    editingLetter?: MockLetter;
    letters: MockLetter[];
    loading?: boolean;
    onBack: () => void;
    onPreview: (letter: MockLetter) => void;
}) {
    if (docType === 'letter') {
        return (
            <LetterComposeView
                editingLetter={editingLetter}
                letters={letters}
                loading={loading}
                onBack={onBack}
                onPreview={onPreview}
            />
        );
    }

    return (
        <GenericComposeView
            docType={docType}
            editingLetter={editingLetter}
            letters={letters}
            loading={loading}
            onBack={onBack}
            onPreview={onPreview}
        />
    );
}

function initialMailboxScreen(searchParams: URLSearchParams): Screen {
    return searchParams.get('tab') === 'outgoing'
        ? { kind: 'outgoing' }
        : { kind: 'incoming' };
}

export function CorrespondencePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [letters, setLetters] = useState<MockLetter[]>(INITIAL_LETTERS);
    const { screen, loading, navigate } = useScreenTransition(initialMailboxScreen(searchParams));
    const [previewLetter, setPreviewLetter] = useState<MockLetter | null>(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);

    const navigateMailbox = useCallback((next: Screen) => {
        navigate(next);
        if (next.kind === 'incoming' || next.kind === 'outgoing') {
            setSearchParams(
                next.kind === 'outgoing' ? { tab: 'outgoing' } : {},
                { replace: true },
            );
        }
    }, [navigate, setSearchParams]);

    const currentLetter = (screen.kind === 'preview' || screen.kind === 'partner-review')
        ? (previewLetter ?? letters.find(l => l.id === screen.letterId) ?? null)
        : null;

    const upsertLetter = (updated: MockLetter) => {
        setLetters(prev => {
            const idx = prev.findIndex(l => l.id === updated.id);
            if (idx >= 0) { const arr = [...prev]; arr[idx] = updated; return arr; }
            return [...prev, updated];
        });
        setPreviewLetter(updated);
    };

    const handleComposePreview = (letter: MockLetter) => {
        const withNum = letters.find(l => l.id === letter.id)
            ? letter
            : { ...letter, registryNumber: nextRegistryNum(letters, letter.docType) };
        upsertLetter(withNum);
        navigate({ kind: 'preview', letterId: withNum.id });
    };

    const handleSend = (partner: MockPartner) => {
        if (!currentLetter) return;
        const updated: MockLetter = { ...currentLetter, status: 'pending_review', partnerId: partner.id, partnerName: partner.name };
        upsertLetter(updated);
        setShowSendModal(false);
    };

    const handleApprove = () => {
        if (!currentLetter) return;
        upsertLetter({ ...currentLetter, status: 'approved' });
    };

    const handleReject = (reason: string) => {
        if (!currentLetter) return;
        upsertLetter({ ...currentLetter, status: 'rejected', rejectionReason: reason });
        setShowRejectModal(false);
    };

    const viewKey = screenKey(screen);

    if (screen.kind === 'incoming' || screen.kind === 'outgoing') {
        return (
            <CorrespondenceRegistryView
                key={viewKey}
                direction={screen.kind}
                onDirectionChange={(dir) => navigateMailbox({ kind: dir })}
            />
        );
    }

    if (screen.kind === 'compose') {
        const dt = screen.docType;
        const editing = screen.editId ? letters.find(l => l.id === screen.editId) : undefined;
        return <ComposeView key={viewKey} docType={dt} editingLetter={editing} letters={letters} loading={loading}
            onBack={() => navigate({ kind: 'outgoing' })}
            onPreview={handleComposePreview} />;
    }

    if (screen.kind === 'preview' && currentLetter) {
        const dt = currentLetter.docType;
        return (<>
            <CorrespondenceLetterPreview key={viewKey} letter={currentLetter} mode="employee" loading={loading}
                onBack={() => navigate({ kind: 'outgoing' })}
                onSendToReview={() => setShowSendModal(true)}
                onEdit={() => navigate({ kind: 'compose', docType: dt, editId: currentLetter.id })} />
            {showSendModal && <SendToPartnerModal onClose={() => setShowSendModal(false)} onSend={handleSend} />}
        </>);
    }

    if (screen.kind === 'partner-review' && currentLetter) {
        return (<>
            <CorrespondenceLetterPreview key={viewKey} letter={currentLetter} mode="partner" loading={loading}
                onBack={() => navigate({ kind: 'incoming' })}
                onApprove={handleApprove}
                onReject={() => setShowRejectModal(true)} />
            {showRejectModal && <RejectModal onClose={() => setShowRejectModal(false)} onReject={handleReject} />}
        </>);
    }

    return <MailboxView key="outgoing-fallback" tab="outgoing" onNavigate={navigateMailbox} />;
}

export default CorrespondencePage;
