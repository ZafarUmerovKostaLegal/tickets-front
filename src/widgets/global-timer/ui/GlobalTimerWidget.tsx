import { useState, useEffect, useReducer, useCallback, useRef } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { routes } from '@shared/config';
import { canAccessTimeTracking, canOverrideReportPreviewWeeklyLock } from '@entities/time-tracking/model/timeTrackingAccess';
import { persistTimesheetTimerStopToApi, type TimesheetTimerEntrySnapshot } from '@entities/time-tracking';
import { useAppToast } from '@shared/ui';
import { TT_TIMESHEET_TIMER_LS_PREFIX, notifyTimesheetTimerStorageChanged } from '@shared/lib/ttTimerLocalStorage';
import { getBasePageTitle, setTimerTitleOverride } from '@shared/lib/pageTitle';
import './GlobalTimerWidget.css';

declare global {
    interface Window {
        documentPictureInPicture?: {
            requestWindow(options?: {
                width?: number;
                height?: number;
                disallowReturnToOpener?: boolean;
            }): Promise<Window & typeof globalThis>;
            window: (Window & typeof globalThis) | null;
        };
    }
}
const POS_LS_KEY = 'gtw_position';
const GTW_STOP_EVENT = 'gtw:stop-requested';
const GTW_PAUSE_TOGGLE_EVENT = 'gtw:pause-toggle-requested';
export const TT_TIMER_STOPPED_EVENT = 'tt:timer-widget-stopped';
export const TT_TIMER_PAUSE_CHANGED_EVENT = 'tt:timer-widget-pause-changed';
export type TtTimerStoppedDetail = {
    entryId: string;
    totalHours: number;
    totalDurationSeconds: number;
    serverEntryId?: string;
    persisted?: boolean;
};
export type TtTimerPauseChangedDetail = {
    entryId: string;
    totalHours: number;
    totalDurationSeconds: number;
    paused: boolean;
};
type Snapshot = TimesheetTimerEntrySnapshot;
type Payload = {
    v: 1;
    authUserId: number;
    entryId: string;
    startedAt: number;
    snapshot: Snapshot;
    paused?: boolean;
};
type Pos = {
    x: number;
    y: number;
};
function readPayload(userId: number): Payload | null {
    try {
        const raw = localStorage.getItem(`${TT_TIMESHEET_TIMER_LS_PREFIX}${userId}`);
        if (!raw)
            return null;
        const o = JSON.parse(raw) as Partial<Payload>;
        if (o.v !== 1 ||
            typeof o.authUserId !== 'number' ||
            typeof o.entryId !== 'string' ||
            typeof o.startedAt !== 'number' ||
            !o.snapshot) {
            return null;
        }
        return o as Payload;
    }
    catch {
        return null;
    }
}
function readSavedPos(): Pos | null {
    try {
        const raw = localStorage.getItem(POS_LS_KEY);
        if (!raw)
            return null;
        const o = JSON.parse(raw) as Pos;
        if (typeof o.x === 'number' && typeof o.y === 'number')
            return o;
        return null;
    }
    catch {
        return null;
    }
}
function savePos(pos: Pos) {
    try {
        localStorage.setItem(POS_LS_KEY, JSON.stringify(pos));
    }
    catch { }
}
function clamp(pos: Pos, elW: number, elH: number): Pos {
    const maxX = window.innerWidth - elW;
    const maxY = window.innerHeight - elH;
    return {
        x: Math.max(0, Math.min(pos.x, maxX)),
        y: Math.max(0, Math.min(pos.y, maxY)),
    };
}
function fmtClock(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0)
        return '0:00:00';
    const s = Math.floor(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
function msToSeconds(elapsedMs: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0)
        return 0;
    return Math.max(0, Math.floor(elapsedMs / 1000));
}
function baseDurationSecondsFromSnapshot(snapshot: Snapshot): number {
    if (typeof snapshot.durationSeconds === 'number' && Number.isFinite(snapshot.durationSeconds)) {
        return Math.max(0, Math.trunc(snapshot.durationSeconds));
    }
    const h = snapshot.hours ?? 0;
    if (!Number.isFinite(h) || h <= 0)
        return 0;
    return Math.round(h * 3600);
}
function elapsedSecondsFromPayload(p: Payload): number {
    const base = baseDurationSecondsFromSnapshot(p.snapshot);
    if (p.paused)
        return base;
    return base + msToSeconds(Date.now() - p.startedAt);
}
function writePayload(p: Payload) {
    try {
        localStorage.setItem(`${TT_TIMESHEET_TIMER_LS_PREFIX}${p.authUserId}`, JSON.stringify(p));
        notifyTimesheetTimerStorageChanged(p.authUserId);
    }
    catch { }
}
function dispatchPauseChanged(p: Payload, paused: boolean) {
    const totalDurationSeconds = elapsedSecondsFromPayload(p);
    window.dispatchEvent(new CustomEvent<TtTimerPauseChangedDetail>(TT_TIMER_PAUSE_CHANGED_EVENT, {
        detail: {
            entryId: p.entryId,
            totalHours: totalDurationSeconds / 3600,
            totalDurationSeconds,
            paused,
        },
    }));
}
function discardStaleDocumentPiP(pipWinRef: React.MutableRefObject<(Window & typeof globalThis) | null>, pipIntervalRef: React.MutableRefObject<ReturnType<typeof setInterval> | null>, setPiPOpen: (open: boolean) => void, onStaleClear?: () => void) {
    const w = pipWinRef.current;
    if (!w?.closed)
        return;
    pipWinRef.current = null;
    if (pipIntervalRef.current) {
        clearInterval(pipIntervalRef.current);
        pipIntervalRef.current = null;
    }
    setPiPOpen(false);
    onStaleClear?.();
}
function closeOrphanDocumentPiPWindow(dpi: NonNullable<Window['documentPictureInPicture']>) {
    const w = dpi.window;
    if (!w || w.closed)
        return;
    try {
        w.close();
    }
    catch {
    }
}
const PIP_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #0f172a;
    display: flex; align-items: center; justify-content: center;
    height: 100vh; overflow: hidden;
    font-family: 'Montserrat', system-ui, sans-serif;
    cursor: default; user-select: none;
  }
  .pip {
    display: flex; align-items: center; gap: 10px;
    padding: 0 14px; width: 100%;
  }
  .pip__pulse {
    width: 9px; height: 9px; border-radius: 50%;
    background: #ef4444; flex-shrink: 0;
    animation: pulse 1.6s infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50%       { opacity: 0.4; transform: scale(0.7); }
  }
  .pip__clock {
    font-size: 26px; font-weight: 800; color: #fff;
    font-variant-numeric: tabular-nums; letter-spacing: 0.02em;
    flex-shrink: 0;
  }
  .pip__info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .pip__project {
    font-size: 13px; font-weight: 600; color: #e2e8f0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pip__task {
    font-size: 11px; color: #94a3b8;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .pip__pause {
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
    border-radius: 9px; border: none;
    background: rgba(245, 158, 11, 0.85);
    color: #fff; cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .pip__pause:hover { background: #d97706; }
  .pip__pause:active { transform: scale(0.93); }
  .pip__pause--resume { background: rgba(34, 197, 94, 0.85); }
  .pip__pause--resume:hover { background: #16a34a; }
  .pip__stop {
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px;
    border-radius: 9px; border: none;
    background: rgba(239, 68, 68, 0.85);
    color: #fff; cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .pip__stop:hover { background: #dc2626; }
  .pip__stop:active { transform: scale(0.93); }
  .pip__stop--busy { opacity: 0.55; pointer-events: none; }
`;
const DRAG_THRESHOLD = 4;
export function GlobalTimerWidget() {
    const { user } = useCurrentUser();
    const { pushToast } = useAppToast();
    const [payload, setPayload] = useState<Payload | null>(null);
    const [, tick] = useReducer((n: number) => n + 1, 0);
    const [hiding, setHiding] = useState(false);
    const [stopping, setStopping] = useState(false);
    const [isPiPOpen, setIsPiPOpen] = useState(false);
    const [pipReplacesFloatingWidget, setPipReplacesFloatingWidget] = useState(false);
    const [pipSupported] = useState(() => 'documentPictureInPicture' in window);
    const elRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState<Pos | null>(() => readSavedPos());
    const dragging = useRef(false);
    const didDrag = useRef(false);
    const dragStart = useRef<{
        mx: number;
        my: number;
        ex: number;
        ey: number;
    } | null>(null);
    const payloadRef = useRef<Payload | null>(null);
    useEffect(() => { payloadRef.current = payload; }, [payload]);
    const pipWinRef = useRef<(Window & typeof globalThis) | null>(null);
    const pipIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sync = useCallback(() => {
        if (!user?.id) {
            setPayload(null);
            return;
        }
        const p = readPayload(user.id);
        setPayload((prev) => {
            if (!p && !prev)
                return prev;
            if (!p)
                return null;
            if (prev &&
                prev.entryId === p.entryId &&
                prev.startedAt === p.startedAt &&
                Boolean(prev.paused) === Boolean(p.paused) &&
                prev.snapshot.durationSeconds === p.snapshot.durationSeconds &&
                prev.snapshot.hours === p.snapshot.hours)
                return prev;
            return p;
        });
    }, [user?.id]);
    useEffect(() => {
        sync();
        const interval = setInterval(() => {
            discardStaleDocumentPiP(pipWinRef, pipIntervalRef, setIsPiPOpen, () => setPipReplacesFloatingWidget(false));
            sync();
            tick();
        }, 1000);
        const onStorage = (e: StorageEvent) => {
            if (e.key?.startsWith(TT_TIMESHEET_TIMER_LS_PREFIX))
                sync();
        };
        window.addEventListener('storage', onStorage);
        return () => {
            clearInterval(interval);
            window.removeEventListener('storage', onStorage);
        };
    }, [sync]);
    useEffect(() => {
        if (payload)
            setHiding(false);
    }, [payload]);
    useEffect(() => {
        if (!payload) {
            setTimerTitleOverride(false);
            document.title = getBasePageTitle();
            return;
        }
        const updateTitle = () => {
            const totalSec = elapsedSecondsFromPayload(payload);
            const project = payload.snapshot.project || '';
            const prefix = payload.paused ? '⏸' : '⏱';
            const title = `${prefix} ${fmtClock(totalSec)}${project ? ` — ${project}` : ''}`;
            setTimerTitleOverride(true, title);
        };
        updateTitle();
        const id = setInterval(updateTitle, 1000);
        return () => clearInterval(id);
    }, [payload]);
    useEffect(() => {
        return () => {
            setTimerTitleOverride(false);
        };
    }, []);
    useEffect(() => {
        discardStaleDocumentPiP(pipWinRef, pipIntervalRef, setIsPiPOpen, () => setPipReplacesFloatingWidget(false));
        if (!payload) {
            setPipReplacesFloatingWidget(false);
            if (pipWinRef.current)
                pipWinRef.current.close();
        }
    }, [payload]);
    const togglePause = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
        const p = payloadRef.current;
        if (!p || stopping)
            return;
        if (p.paused) {
            const resumed: Payload = { ...p, paused: false, startedAt: Date.now() };
            writePayload(resumed);
            payloadRef.current = resumed;
            setPayload(resumed);
            dispatchPauseChanged(resumed, false);
            return;
        }
        const addSec = msToSeconds(Date.now() - p.startedAt);
        const totalDurationSeconds = baseDurationSecondsFromSnapshot(p.snapshot) + addSec;
        const paused: Payload = {
            ...p,
            paused: true,
            startedAt: Date.now(),
            snapshot: {
                ...p.snapshot,
                durationSeconds: totalDurationSeconds,
                hours: totalDurationSeconds / 3600,
            },
        };
        writePayload(paused);
        payloadRef.current = paused;
        setPayload(paused);
        dispatchPauseChanged(paused, true);
    }, [stopping]);
    const stopTimer = useCallback(async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const p = payloadRef.current;
        if (!p || stopping)
            return;
        setStopping(true);
        try {
            const totalDurationSeconds = elapsedSecondsFromPayload(p);
            const totalHours = totalDurationSeconds / 3600;
            let serverEntryId: string | undefined;
            let persisted = false;
            if (user) {
                const result = await persistTimesheetTimerStopToApi({
                    authUserId: p.authUserId,
                    entryId: p.entryId,
                    totalDurationSeconds,
                    snapshot: p.snapshot,
                    user,
                    canOverrideWeeklyLock: canOverrideReportPreviewWeeklyLock(user),
                });
                if (result.saved) {
                    persisted = true;
                    serverEntryId = result.serverEntryId;
                }
                else if (result.reason === 'blocked') {
                    pushToast({
                        variant: 'warning',
                        message: 'Нельзя сохранить запись: отчётный период закрыт.',
                    });
                }
                else if (result.reason !== 'too_short') {
                    pushToast({
                        variant: 'error',
                        message: 'Не удалось сохранить запись таймера.',
                    });
                }
            }
            try {
                localStorage.removeItem(`${TT_TIMESHEET_TIMER_LS_PREFIX}${p.authUserId}`);
                notifyTimesheetTimerStorageChanged(p.authUserId);
            }
            catch { }
            payloadRef.current = null;
            setPayload(null);
            window.dispatchEvent(new CustomEvent<TtTimerStoppedDetail>(TT_TIMER_STOPPED_EVENT, {
                detail: {
                    entryId: p.entryId,
                    totalHours,
                    totalDurationSeconds,
                    serverEntryId,
                    persisted,
                },
            }));
        }
        catch {
            pushToast({
                variant: 'error',
                message: 'Не удалось остановить таймер.',
            });
        }
        finally {
            setStopping(false);
        }
    }, [stopping, user, pushToast]);
    useEffect(() => {
        const onStop = () => void stopTimer();
        const onPauseToggle = () => togglePause();
        window.addEventListener(GTW_STOP_EVENT, onStop);
        window.addEventListener(GTW_PAUSE_TOGGLE_EVENT, onPauseToggle);
        return () => {
            window.removeEventListener(GTW_STOP_EVENT, onStop);
            window.removeEventListener(GTW_PAUSE_TOGGLE_EVENT, onPauseToggle);
        };
    }, [stopTimer, togglePause]);
    const openPiP = useCallback(async (source: 'visibility' | 'user' = 'user') => {
        discardStaleDocumentPiP(pipWinRef, pipIntervalRef, setIsPiPOpen, () => setPipReplacesFloatingWidget(false));
        const dpi = window.documentPictureInPicture;
        if (pipWinRef.current || !dpi || !payloadRef.current)
            return;
        if (dpi.window && !dpi.window.closed)
            closeOrphanDocumentPiPWindow(dpi);
        try {
            const pipWin = await dpi.requestWindow({
                width: 340,
                height: 82,
                disallowReturnToOpener: false,
            });
            pipWinRef.current = pipWin;
            setIsPiPOpen(true);
            if (source === 'visibility')
                setPipReplacesFloatingWidget(true);
            const styleEl = pipWin.document.createElement('style');
            styleEl.textContent = PIP_STYLES;
            pipWin.document.head.appendChild(styleEl);
            const root = pipWin.document.createElement('div');
            root.className = 'pip';
            const pulse = pipWin.document.createElement('span');
            pulse.className = 'pip__pulse';
            root.appendChild(pulse);
            const clock = pipWin.document.createElement('span');
            clock.className = 'pip__clock';
            clock.id = 'pip-clock';
            clock.textContent = '0:00:00';
            root.appendChild(clock);
            const info = pipWin.document.createElement('span');
            info.className = 'pip__info';
            const project = pipWin.document.createElement('span');
            project.className = 'pip__project';
            project.id = 'pip-project';
            info.appendChild(project);
            const task = pipWin.document.createElement('span');
            task.className = 'pip__task';
            task.id = 'pip-task';
            info.appendChild(task);
            root.appendChild(info);
            const pauseBtn = pipWin.document.createElement('button');
            pauseBtn.type = 'button';
            pauseBtn.className = 'pip__pause';
            pauseBtn.id = 'pip-pause';
            pauseBtn.title = 'Пауза';
            const svgNS = 'http://www.w3.org/2000/svg';
            const pauseSvg = pipWin.document.createElementNS(svgNS, 'svg');
            pauseSvg.setAttribute('width', '14');
            pauseSvg.setAttribute('height', '14');
            pauseSvg.setAttribute('viewBox', '0 0 24 24');
            pauseSvg.setAttribute('fill', 'currentColor');
            const pauseRect1 = pipWin.document.createElementNS(svgNS, 'rect');
            pauseRect1.setAttribute('x', '6');
            pauseRect1.setAttribute('y', '5');
            pauseRect1.setAttribute('width', '4');
            pauseRect1.setAttribute('height', '14');
            pauseRect1.setAttribute('rx', '1');
            const pauseRect2 = pipWin.document.createElementNS(svgNS, 'rect');
            pauseRect2.setAttribute('x', '14');
            pauseRect2.setAttribute('y', '5');
            pauseRect2.setAttribute('width', '4');
            pauseRect2.setAttribute('height', '14');
            pauseRect2.setAttribute('rx', '1');
            pauseSvg.appendChild(pauseRect1);
            pauseSvg.appendChild(pauseRect2);
            pauseBtn.appendChild(pauseSvg);
            root.appendChild(pauseBtn);
            const stopBtn = pipWin.document.createElement('button');
            stopBtn.type = 'button';
            stopBtn.className = 'pip__stop';
            stopBtn.id = 'pip-stop';
            stopBtn.title = 'Остановить таймер';
            const stopSvg = pipWin.document.createElementNS(svgNS, 'svg');
            stopSvg.setAttribute('width', '14');
            stopSvg.setAttribute('height', '14');
            stopSvg.setAttribute('viewBox', '0 0 24 24');
            stopSvg.setAttribute('fill', 'currentColor');
            const rect = pipWin.document.createElementNS(svgNS, 'rect');
            rect.setAttribute('x', '4');
            rect.setAttribute('y', '4');
            rect.setAttribute('width', '16');
            rect.setAttribute('height', '16');
            rect.setAttribute('rx', '2');
            stopSvg.appendChild(rect);
            stopBtn.appendChild(stopSvg);
            root.appendChild(stopBtn);
            pipWin.document.body.appendChild(root);
            pipWin.document.getElementById('pip-pause')?.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent(GTW_PAUSE_TOGGLE_EVENT));
            });
            pipWin.document.getElementById('pip-stop')?.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent(GTW_STOP_EVENT));
            });
            const updatePiP = () => {
                const p = payloadRef.current;
                if (!p)
                    return;
                const totalSec = elapsedSecondsFromPayload(p);
                const clockEl = pipWin.document.getElementById('pip-clock');
                const projectEl = pipWin.document.getElementById('pip-project');
                const taskEl = pipWin.document.getElementById('pip-task');
                const pauseBtnEl = pipWin.document.getElementById('pip-pause');
                const stopBtnEl = pipWin.document.getElementById('pip-stop');
                const pulseEl = pipWin.document.querySelector('.pip__pulse');
                if (clockEl)
                    clockEl.textContent = fmtClock(totalSec);
                if (projectEl)
                    projectEl.textContent = p.snapshot.project || '';
                if (taskEl)
                    taskEl.textContent = p.snapshot.task || '';
                if (pauseBtnEl) {
                    pauseBtnEl.classList.toggle('pip__pause--resume', Boolean(p.paused));
                    pauseBtnEl.title = p.paused ? 'Продолжить' : 'Пауза';
                }
                if (stopBtnEl)
                    stopBtnEl.classList.toggle('pip__stop--busy', stopping);
                if (pulseEl instanceof HTMLElement)
                    pulseEl.style.animationPlayState = p.paused ? 'paused' : 'running';
            };
            updatePiP();
            pipIntervalRef.current = setInterval(updatePiP, 1000);
            pipWin.addEventListener('pagehide', () => {
                if (pipIntervalRef.current)
                    clearInterval(pipIntervalRef.current);
                pipWinRef.current = null;
                setIsPiPOpen(false);
                setPipReplacesFloatingWidget(false);
            });
        }
        catch { }
    }, [stopping]);
    const togglePiP = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        discardStaleDocumentPiP(pipWinRef, pipIntervalRef, setIsPiPOpen, () => setPipReplacesFloatingWidget(false));
        if (pipWinRef.current) {
            pipWinRef.current.close();
        }
        else {
            await openPiP('user');
        }
    }, [openPiP]);
    useEffect(() => {
        if (!pipSupported)
            return;
        const onVisChange = () => {
            discardStaleDocumentPiP(pipWinRef, pipIntervalRef, setIsPiPOpen, () => setPipReplacesFloatingWidget(false));
            if (document.hidden && payloadRef.current && !pipWinRef.current) {
                void openPiP('visibility');
            }
        };
        document.addEventListener('visibilitychange', onVisChange);
        return () => document.removeEventListener('visibilitychange', onVisChange);
    }, [pipSupported, openPiP]);
    useEffect(() => {
        return () => {
            setPipReplacesFloatingWidget(false);
            discardStaleDocumentPiP(pipWinRef, pipIntervalRef, setIsPiPOpen, () => setPipReplacesFloatingWidget(false));
            const w = pipWinRef.current;
            if (w && !w.closed) {
                try {
                    w.close();
                }
                catch {
                }
            }
            pipWinRef.current = null;
            if (pipIntervalRef.current) {
                clearInterval(pipIntervalRef.current);
                pipIntervalRef.current = null;
            }
        };
    }, []);
    useEffect(() => {
        const onMove = (e: PointerEvent) => {
            const s = dragStart.current;
            if (!s)
                return;
            const dx = e.clientX - s.mx;
            const dy = e.clientY - s.my;
            if (!dragging.current) {
                if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD)
                    return;
                dragging.current = true;
                didDrag.current = true;
            }
            const el = elRef.current;
            const w = el?.offsetWidth ?? 240;
            const h = el?.offsetHeight ?? 44;
            setPos(clamp({ x: s.ex + dx, y: s.ey + dy }, w, h));
        };
        const onUp = () => {
            if (dragging.current) {
                setPos((p) => {
                    if (p)
                        savePos(p); return p;
                });
            }
            dragging.current = false;
            dragStart.current = null;
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
    }, []);
    const onPointerDown = (e: React.PointerEvent) => {
        if ((e.target as HTMLElement).closest('button'))
            return;
        const el = elRef.current;
        if (!el)
            return;
        const rect = el.getBoundingClientRect();
        didDrag.current = false;
        dragStart.current = { mx: e.clientX, my: e.clientY, ex: rect.left, ey: rect.top };
        el.setPointerCapture(e.pointerId);
    };
    if (!payload)
        return null;
    const pipLive = Boolean(pipWinRef.current && !pipWinRef.current.closed);
    if (pipSupported && isPiPOpen && pipReplacesFloatingWidget && pipLive)
        return null;
    const elapsedSec = elapsedSecondsFromPayload(payload);
    const project = payload.snapshot.project || '';
    const task = payload.snapshot.task || '';
    const goToTimeTracking = () => {
        if (didDrag.current)
            return;
        if (user && canAccessTimeTracking(user)) {
            window.location.href = routes.timeTracking;
        }
        else {
            window.location.href = routes.home;
        }
    };
    const style: React.CSSProperties = pos
        ? { left: pos.x, top: pos.y, right: 'auto' }
        : {};
    return (<div ref={elRef} className={`gtw${hiding ? ' gtw--hiding' : ''}${dragging.current ? ' gtw--dragging' : ''}${payload.paused ? ' gtw--paused' : ''}`} style={style} onClick={goToTimeTracking} onPointerDown={onPointerDown} role="status" aria-label={payload.paused ? 'Таймер на паузе' : 'Таймер идёт'}>
        <span className="gtw__pulse" />
        <span className="gtw__clock">{fmtClock(elapsedSec)}</span>
        {(project || task) && (<span className="gtw__info">
            {project && <span className="gtw__project">{project}</span>}
            {task && <span className="gtw__task">{task}</span>}
        </span>)}


        {pipSupported && (<button type="button" className={`gtw__pip-btn${isPiPOpen ? ' gtw__pip-btn--active' : ''}`} onClick={togglePiP} title={isPiPOpen ? 'Закрыть мини-окно' : 'Открыть поверх всех окон'} aria-label={isPiPOpen ? 'Закрыть мини-окно' : 'Открыть поверх всех окон'}>
            {isPiPOpen ? (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="15" rx="2" />
                <polyline points="17 2 12 7 7 2" />
            </svg>) : (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="15" rx="2" />
                <polyline points="7 7 12 2 17 7" />
            </svg>)}
        </button>)}

        <button type="button" className={`gtw__pause${payload.paused ? ' gtw__pause--resume' : ''}`} onClick={togglePause} disabled={stopping} title={payload.paused ? 'Продолжить' : 'Пауза'} aria-label={payload.paused ? 'Продолжить' : 'Пауза'}>
            {payload.paused ? (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M9 7.5v9l7.5-4.5L9 7.5z" />
            </svg>) : (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>)}
        </button>

        <button type="button" className={`gtw__stop${stopping ? ' gtw__stop--busy' : ''}`} onClick={stopTimer} disabled={stopping} title="Остановить таймер" aria-label="Остановить таймер">
            {stopping ? (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <path d="M12 2a10 10 0 1 1 0 20" />
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
            </svg>) : (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>)}
        </button>
    </div>);
}
