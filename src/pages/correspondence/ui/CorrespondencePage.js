import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CorrespondenceLetterPreview } from './CorrespondenceLetterPreview';
import { CorrespondenceLetterWorkspace } from './CorrespondenceLetterWorkspace';
import { CorrespondenceRegistryView } from './CorrespondenceRegistryView';
import { CorrespondenceShell } from './CorrespondenceShell';
import { coverModelToMockLetter, mockLetterToCoverModel } from '../lib/correspondenceCoverLetterModel';
import { CorrespondenceScreenSkeleton, } from './CorrespondenceSkeleton';
import './CorrespondencePage.css';
import './CorrespondenceShell.css';
const CORRESPONDENCE_TAB_LABELS = {
    incoming: 'Входящие',
    outgoing: 'Исходящие',
};
const LOAD_MS = 420;
function screenKey(screen) {
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
function useScreenTransition(initial) {
    const [screen, setScreen] = useState(initial);
    const [loading, setLoading] = useState(true);
    const timerRef = useRef(null);
    useEffect(() => {
        timerRef.current = setTimeout(() => setLoading(false), LOAD_MS);
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
        };
    }, []);
    const navigate = useCallback((next) => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        setScreen(next);
        setLoading(true);
        timerRef.current = setTimeout(() => setLoading(false), LOAD_MS);
    }, []);
    return { screen, loading, navigate };
}
export const MOCK_PARTNERS = [
    { id: 1, name: 'Иванов Иван Иванович', position: 'Старший партнёр' },
    { id: 2, name: 'Петрова Анна Сергеевна', position: 'Партнёр' },
    { id: 3, name: 'Сидоров Михаил Владимирович', position: 'Партнёр' },
    { id: 4, name: 'Козлова Елена Дмитриевна', position: 'Партнёр' },
];
const INITIAL_LETTERS = [
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
export const DOC_TYPE_META = {
    letter: { label: 'Письмо', plural: 'Письма', writeLabel: 'Написать письмо', color: 'blue' },
    contract: { label: 'Договор', plural: 'Договоры', writeLabel: 'Создать договор', color: 'green' },
    note: { label: 'Служебная записка', plural: 'Служебные записки', writeLabel: 'Написать записку', color: 'purple' },
};
export const STATUS_META = {
    draft: { label: 'Черновик', cls: 'corr-n__badge--draft' },
    pending_review: { label: 'На согласовании', cls: 'corr-n__badge--pending' },
    rejected: { label: 'Отклонено', cls: 'corr-n__badge--rejected' },
    approved: { label: 'Подтверждено', cls: 'corr-n__badge--approved' },
};
export function formatDateRu(iso) {
    const d = new Date(`${iso}T12:00:00`);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function nextRegistryNum(letters, docType) {
    const year = new Date().getFullYear();
    const prefix = docType === 'letter' ? 'ИСХ' : docType === 'contract' ? 'ДОГ' : 'СЗ';
    const nums = letters
        .filter(l => l.docType === docType)
        .map(l => { const m = l.registryNumber.match(/\/(\d+)$/); return m ? parseInt(m[1], 10) : 0; });
    return `${prefix}-${year}/${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`;
}
export function IcoMailWrite() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" }), _jsx("polyline", { points: "22,6 12,13 2,6" })] }));
}
export function IcoContract() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" }), _jsx("polyline", { points: "14 2 14 8 20 8" }), _jsx("line", { x1: "16", y1: "13", x2: "8", y2: "13" }), _jsx("line", { x1: "16", y1: "17", x2: "8", y2: "17" })] }));
}
export function IcoNote() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
}
export function IcoInbox() {
    return (_jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12" }), _jsx("path", { d: "M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" })] }));
}
export function IcoPlus() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "12", y1: "5", x2: "12", y2: "19" }), _jsx("line", { x1: "5", y1: "12", x2: "19", y2: "12" })] }));
}
export function IcoChevRight() {
    return (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "9 18 15 12 9 6" }) }));
}
export function IcoPaperclip() {
    return (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("path", { d: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" }) }));
}
export function IcoAlert() {
    return (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("circle", { cx: "12", cy: "12", r: "10" }), _jsx("line", { x1: "12", y1: "8", x2: "12", y2: "12" }), _jsx("line", { x1: "12", y1: "16", x2: "12.01", y2: "16" })] }));
}
export function IcoEye() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }), _jsx("circle", { cx: "12", cy: "12", r: "3" })] }));
}
export function IcoCheck() {
    return (_jsx("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }));
}
export function IcoCross() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }), _jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })] }));
}
export function IcoSend() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }), _jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })] }));
}
export function IcoEdit() {
    return (_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", "aria-hidden": true, children: [_jsx("path", { d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" }), _jsx("path", { d: "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" })] }));
}
function SendToPartnerModal({ onClose, onSend }) {
    const [selected, setSelected] = useState(null);
    const [comment, setComment] = useState('');
    return (_jsx("div", { className: "corr-n__modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "corr-n__modal-panel", role: "dialog", "aria-modal": true, "aria-label": "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "corr-n__modal-header", children: [_jsx("h3", { className: "corr-n__modal-title", children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" }), _jsx("button", { type: "button", className: "corr-n__modal-close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx(IcoCross, {}) })] }), _jsxs("div", { className: "corr-n__modal-body", children: [_jsx("p", { className: "corr-n__modal-hint", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043F\u0430\u0440\u0442\u043D\u0451\u0440\u0430 \u0434\u043B\u044F \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u044F \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430:" }), _jsx("div", { className: "corr-n__partner-list", children: MOCK_PARTNERS.map(p => (_jsxs("button", { type: "button", className: `corr-n__partner-item${selected?.id === p.id ? ' corr-n__partner-item--on' : ''}`, onClick: () => setSelected(p), children: [_jsx("div", { className: "corr-n__partner-avatar", children: p.name[0] }), _jsxs("div", { className: "corr-n__partner-info", children: [_jsx("span", { className: "corr-n__partner-name", children: p.name }), _jsx("span", { className: "corr-n__partner-pos", children: p.position })] }), selected?.id === p.id && _jsx("span", { className: "corr-n__partner-check", children: _jsx(IcoCheck, {}) })] }, p.id))) }), _jsxs("div", { className: "corr-n__form-field", style: { marginTop: '1rem' }, children: [_jsxs("label", { className: "corr-n__form-label", children: ["\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 ", _jsx("span", { className: "corr-n__form-hint", children: "(\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" })] }), _jsx("textarea", { className: "corr-n__textarea corr-n__textarea--sm", rows: 3, placeholder: "\u0427\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C...", value: comment, onChange: e => setComment(e.target.value) })] })] }), _jsxs("div", { className: "corr-n__modal-footer", children: [_jsx("button", { type: "button", className: "corr-n__btn-secondary", onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsxs("button", { type: "button", className: "corr-n__btn-primary", disabled: !selected, onClick: () => selected && onSend(selected), children: [_jsx(IcoSend, {}), " \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435"] })] })] }) }));
}
function RejectModal({ onClose, onReject }) {
    const [reason, setReason] = useState('');
    return (_jsx("div", { className: "corr-n__modal-backdrop", onClick: onClose, children: _jsxs("div", { className: "corr-n__modal-panel", role: "dialog", "aria-modal": true, "aria-label": "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", onClick: e => e.stopPropagation(), children: [_jsxs("div", { className: "corr-n__modal-header", children: [_jsx("h3", { className: "corr-n__modal-title", children: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F" }), _jsx("button", { type: "button", className: "corr-n__modal-close", onClick: onClose, "aria-label": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C", children: _jsx(IcoCross, {}) })] }), _jsxs("div", { className: "corr-n__modal-body", children: [_jsx("p", { className: "corr-n__modal-hint", children: "\u041E\u043F\u0438\u0448\u0438\u0442\u0435, \u0447\u0442\u043E \u043D\u0443\u0436\u043D\u043E \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0438\u043B\u0438 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0432 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0435:" }), _jsx("textarea", { className: "corr-n__textarea", rows: 5, autoFocus: true, placeholder: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u044F \u043A \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0443...", value: reason, onChange: e => setReason(e.target.value) })] }), _jsxs("div", { className: "corr-n__modal-footer", children: [_jsx("button", { type: "button", className: "corr-n__btn-secondary", onClick: onClose, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsxs("button", { type: "button", className: "corr-n__btn-danger", disabled: !reason.trim(), onClick: () => reason.trim() && onReject(reason.trim()), children: [_jsx(IcoCross, {}), " \u041E\u0442\u043A\u043B\u043E\u043D\u0438\u0442\u044C"] })] })] }) }));
}
function buildCorrespondenceNavTabs(active, onNavigate) {
    return ['incoming', 'outgoing'].map((tab) => ({
        id: tab,
        label: CORRESPONDENCE_TAB_LABELS[tab],
        active: active === tab,
        onClick: () => onNavigate({ kind: tab }),
    }));
}
function MailboxView({ tab, onNavigate }) {
    return (_jsx(CorrespondenceShell, { activeTab: CORRESPONDENCE_TAB_LABELS[tab], tabs: buildCorrespondenceNavTabs(tab, onNavigate) }));
}
function LetterComposeView({ editingLetter, letters, loading, onBack, onPreview }) {
    const [subject, setSubject] = useState(editingLetter?.subject ?? '');
    const [coverModel, setCoverModel] = useState(() => mockLetterToCoverModel(editingLetter ?? {
        body: '',
        counterparty: '',
        date: new Date().toISOString().slice(0, 10),
    }));
    const [attachments, setAttachments] = useState(editingLetter?.attachments ?? []);
    const fileRef = useRef(null);
    useEffect(() => {
        if (editingLetter) {
            setSubject(editingLetter.subject);
            setCoverModel(mockLetterToCoverModel(editingLetter));
            setAttachments(editingLetter.attachments);
        }
    }, [editingLetter]);
    const patchCoverModel = useCallback((patch) => {
        setCoverModel((prev) => ({ ...prev, ...patch }));
    }, []);
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files ?? []);
        setAttachments(prev => [...prev, ...files.map(f => ({
                id: generateId(),
                name: f.name,
                size: f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} МБ` : `${Math.round(f.size / 1024)} КБ`,
            }))]);
        e.target.value = '';
    };
    const draftLetter = coverModelToMockLetter(coverModel, {
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
    });
    const handlePreview = () => {
        if (!subject.trim())
            return;
        onPreview(draftLetter);
    };
    return (_jsxs(_Fragment, { children: [editingLetter?.status === 'rejected' && editingLetter.rejectionReason && !loading && (_jsx("div", { className: "corr-doc-preview__banner-wrap", children: _jsxs("div", { className: "corr-n__banner corr-n__banner--rejected", children: [_jsx("div", { className: "corr-n__banner-icon", children: _jsx(IcoAlert, {}) }), _jsxs("div", { children: [_jsxs("div", { className: "corr-n__banner-title", children: ["\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", editingLetter.partnerName ? ` — ${editingLetter.partnerName}` : ''] }), _jsx("div", { className: "corr-n__banner-text", children: editingLetter.rejectionReason })] })] }) })), _jsx(CorrespondenceLetterWorkspace, { letter: draftLetter, coverModel: coverModel, editable: true, onCoverModelChange: patchCoverModel, loading: loading, navbarTab: "compose", onBack: onBack, toolbarSubject: (_jsxs("label", { className: "corr-doc-preview__subject-field", children: [_jsx("span", { className: "corr-doc-preview__subject-label", children: "\u0422\u0435\u043C\u0430" }), _jsx("input", { type: "text", className: "corr-doc-preview__subject-input", placeholder: "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043F\u0438\u0441\u044C\u043C\u0430", value: subject, onChange: (e) => setSubject(e.target.value), required: true })] })), navbarActions: (_jsxs(_Fragment, { children: [_jsx("input", { ref: fileRef, type: "file", multiple: true, style: { display: 'none' }, onChange: handleFileChange }), _jsxs("button", { type: "button", className: "corr-n__btn-secondary", onClick: () => fileRef.current?.click(), title: "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0444\u0430\u0439\u043B", children: [_jsx(IcoPaperclip, {}), " ", _jsxs("span", { children: ["\u0412\u043B\u043E\u0436\u0435\u043D\u0438\u044F", attachments.length > 0 ? ` (${attachments.length})` : ''] })] }), _jsx("button", { type: "button", className: "corr-n__btn-secondary", onClick: onBack, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsxs("button", { type: "button", className: "corr-n__btn-primary", disabled: !subject.trim(), onClick: handlePreview, children: [_jsx(IcoEye, {}), " \u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440"] })] })) })] }));
}
function GenericComposeView({ docType, editingLetter, letters, loading, onBack, onPreview }) {
    const meta = DOC_TYPE_META[docType];
    const [counterparty, setCounterparty] = useState(editingLetter?.counterparty ?? '');
    const [subject, setSubject] = useState(editingLetter?.subject ?? '');
    const [body, setBody] = useState(editingLetter?.body ?? '');
    const [attachments, setAttachments] = useState(editingLetter?.attachments ?? []);
    const fileRef = useRef(null);
    const textareaRef = useRef(null);
    const handleFileChange = (e) => {
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
        if (!el)
            return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };
    const handlePreview = () => {
        const letter = {
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
    return (_jsx(CorrespondenceShell, { activeTab: composeLabel, onBack: onBack, actions: !loading ? (_jsxs(_Fragment, { children: [_jsx("button", { type: "button", className: "corr-n__btn-secondary", onClick: onBack, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsxs("button", { type: "button", className: "corr-n__btn-primary", disabled: !subject.trim(), onClick: handlePreview, children: [_jsx(IcoEye, {}), " \u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440"] })] })) : undefined, children: loading ? _jsx(CorrespondenceScreenSkeleton, { kind: "compose" }) : (_jsxs("div", { className: "corr-shell__content--narrow", children: [editingLetter?.status === 'rejected' && editingLetter.rejectionReason && (_jsxs("div", { className: "corr-shell__alert corr-n__banner corr-n__banner--rejected", children: [_jsx("div", { className: "corr-n__banner-icon", children: _jsx(IcoAlert, {}) }), _jsxs("div", { children: [_jsxs("div", { className: "corr-n__banner-title", children: ["\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F", editingLetter.partnerName ? ` — ${editingLetter.partnerName}` : ''] }), _jsx("div", { className: "corr-n__banner-text", children: editingLetter.rejectionReason })] })] })), _jsxs("div", { className: "corr-shell__compose-panel", children: [_jsxs("div", { className: "corr-n__form-field", children: [_jsxs("label", { className: "corr-n__form-label", children: ["\u041A\u043E\u043C\u0443 ", _jsx("span", { className: "corr-n__form-hint", children: "(\u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044C)" })] }), _jsx("input", { type: "text", className: "corr-n__input", placeholder: '\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041E\u041E\u041E "\u041F\u0430\u0440\u0442\u043D\u0451\u0440" \u0438\u043B\u0438 \u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0443', value: counterparty, onChange: e => setCounterparty(e.target.value) })] }), _jsxs("div", { className: "corr-n__form-field", children: [_jsxs("label", { className: "corr-n__form-label", children: ["\u0422\u0435\u043C\u0430 ", _jsx("span", { className: "corr-n__form-required", children: "*" })] }), _jsx("input", { type: "text", className: "corr-n__input", placeholder: "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430", value: subject, onChange: e => setSubject(e.target.value) })] }), _jsxs("div", { className: "corr-n__form-field corr-n__form-field--body", children: [_jsx("label", { className: "corr-n__form-label", children: "\u0422\u0435\u043A\u0441\u0442 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430" }), _jsx("textarea", { ref: textareaRef, className: "corr-n__textarea", rows: 14, placeholder: `Введите текст ${docType === 'contract' ? 'договора' : 'записки'}…`, value: body, onChange: e => { setBody(e.target.value); autoGrow(); }, onInput: autoGrow })] }), _jsxs("div", { className: "corr-n__form-field", children: [_jsx("label", { className: "corr-n__form-label", children: "\u0412\u043B\u043E\u0436\u0435\u043D\u0438\u044F" }), _jsx("input", { ref: fileRef, type: "file", multiple: true, style: { display: 'none' }, onChange: handleFileChange }), attachments.length > 0 && (_jsx("div", { className: "corr-n__attach-list", children: attachments.map(a => (_jsxs("div", { className: "corr-n__attach-item", children: [_jsx(IcoPaperclip, {}), _jsx("span", { className: "corr-n__attach-name", children: a.name }), _jsx("span", { className: "corr-n__attach-size", children: a.size }), _jsx("button", { type: "button", className: "corr-n__attach-rm", onClick: () => setAttachments(p => p.filter(x => x.id !== a.id)), "aria-label": `Удалить ${a.name}`, children: _jsx(IcoCross, {}) })] }, a.id))) })), _jsxs("button", { type: "button", className: "corr-n__btn-attach", onClick: () => fileRef.current?.click(), children: [_jsx(IcoPaperclip, {}), " \u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C \u0444\u0430\u0439\u043B"] })] })] })] })) }));
}
function ComposeView({ docType, editingLetter, letters, loading, onBack, onPreview }) {
    if (docType === 'letter') {
        return (_jsx(LetterComposeView, { editingLetter: editingLetter, letters: letters, loading: loading, onBack: onBack, onPreview: onPreview }));
    }
    return (_jsx(GenericComposeView, { docType: docType, editingLetter: editingLetter, letters: letters, loading: loading, onBack: onBack, onPreview: onPreview }));
}
function initialMailboxScreen(searchParams) {
    return searchParams.get('tab') === 'outgoing'
        ? { kind: 'outgoing' }
        : { kind: 'incoming' };
}
function initialCorrTableTab(searchParams) {
    const view = searchParams.get('view');
    if (view === 'new')
        return 'all';
    if (view === 'attention' || view === 'work' || view === 'done' || view === 'all')
        return view;
    return undefined;
}
export function CorrespondencePage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [letters, setLetters] = useState(INITIAL_LETTERS);
    const { screen, loading, navigate } = useScreenTransition(initialMailboxScreen(searchParams));
    const [previewLetter, setPreviewLetter] = useState(null);
    const [showSendModal, setShowSendModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const navigateMailbox = useCallback((next) => {
        navigate(next);
        if (next.kind === 'incoming' || next.kind === 'outgoing') {
            setSearchParams(next.kind === 'outgoing' ? { tab: 'outgoing' } : {}, { replace: true });
        }
    }, [navigate, setSearchParams]);
    const currentLetter = (screen.kind === 'preview' || screen.kind === 'partner-review')
        ? (previewLetter ?? letters.find(l => l.id === screen.letterId) ?? null)
        : null;
    const upsertLetter = (updated) => {
        setLetters(prev => {
            const idx = prev.findIndex(l => l.id === updated.id);
            if (idx >= 0) {
                const arr = [...prev];
                arr[idx] = updated;
                return arr;
            }
            return [...prev, updated];
        });
        setPreviewLetter(updated);
    };
    const handleComposePreview = (letter) => {
        const withNum = letters.find(l => l.id === letter.id)
            ? letter
            : { ...letter, registryNumber: nextRegistryNum(letters, letter.docType) };
        upsertLetter(withNum);
        navigate({ kind: 'preview', letterId: withNum.id });
    };
    const handleSend = (partner) => {
        if (!currentLetter)
            return;
        const updated = { ...currentLetter, status: 'pending_review', partnerId: partner.id, partnerName: partner.name };
        upsertLetter(updated);
        setShowSendModal(false);
    };
    const handleApprove = () => {
        if (!currentLetter)
            return;
        upsertLetter({ ...currentLetter, status: 'approved' });
    };
    const handleReject = (reason) => {
        if (!currentLetter)
            return;
        upsertLetter({ ...currentLetter, status: 'rejected', rejectionReason: reason });
        setShowRejectModal(false);
    };
    const viewKey = screenKey(screen);
    if (screen.kind === 'incoming' || screen.kind === 'outgoing') {
        return (_jsx(CorrespondenceRegistryView, { direction: screen.kind, initialTableTab: initialCorrTableTab(searchParams), onDirectionChange: (dir) => navigateMailbox({ kind: dir }) }, viewKey));
    }
    if (screen.kind === 'compose') {
        const dt = screen.docType;
        const editing = screen.editId ? letters.find(l => l.id === screen.editId) : undefined;
        return _jsx(ComposeView, { docType: dt, editingLetter: editing, letters: letters, loading: loading, onBack: () => navigate({ kind: 'outgoing' }), onPreview: handleComposePreview }, viewKey);
    }
    if (screen.kind === 'preview' && currentLetter) {
        const dt = currentLetter.docType;
        return (_jsxs(_Fragment, { children: [_jsx(CorrespondenceLetterPreview, { letter: currentLetter, mode: "employee", loading: loading, onBack: () => navigate({ kind: 'outgoing' }), onSendToReview: () => setShowSendModal(true), onEdit: () => navigate({ kind: 'compose', docType: dt, editId: currentLetter.id }) }, viewKey), showSendModal && _jsx(SendToPartnerModal, { onClose: () => setShowSendModal(false), onSend: handleSend })] }));
    }
    if (screen.kind === 'partner-review' && currentLetter) {
        return (_jsxs(_Fragment, { children: [_jsx(CorrespondenceLetterPreview, { letter: currentLetter, mode: "partner", loading: loading, onBack: () => navigate({ kind: 'incoming' }), onApprove: handleApprove, onReject: () => setShowRejectModal(true) }, viewKey), showRejectModal && _jsx(RejectModal, { onClose: () => setShowRejectModal(false), onReject: handleReject })] }));
    }
    return _jsx(MailboxView, { tab: "outgoing", onNavigate: navigateMailbox }, "outgoing-fallback");
}
export default CorrespondencePage;
