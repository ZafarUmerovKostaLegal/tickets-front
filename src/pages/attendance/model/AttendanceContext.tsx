import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { fetchWorkdaySettings, patchWorkdaySettings, workdayDtoToSettings, settingsToWorkdayDto, } from '@entities/attendance';
import type { WorkdaySettings } from '@shared/lib/attendanceSettings';
import { DEFAULT_WORKDAY_SETTINGS } from '@shared/lib/attendanceSettings';
import { defaultFrom, defaultTo } from './constants';
import type { AttendanceContextValue } from './AttendanceContext.types';
import { useAttendanceData } from './hooks/useAttendanceData';
import { exportAttendanceToCsv } from './lib/exportExcel';
const AttendanceContext = createContext<AttendanceContextValue | null>(null);
export function useAttendance() {
    const ctx = useContext(AttendanceContext);
    if (!ctx)
        throw new Error('useAttendance must be used within AttendanceProvider');
    return ctx;
}
type AttendanceProviderProps = {
    children: ReactNode;
};
export function AttendanceProvider({ children }: AttendanceProviderProps) {
    const [dateFrom, setDateFrom] = useState(() => defaultFrom());
    const [dateTo, setDateTo] = useState(() => defaultTo());
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [settings, setSettings] = useState<typeof DEFAULT_WORKDAY_SETTINGS>(DEFAULT_WORKDAY_SETTINGS);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const data = useAttendanceData(dateFrom, dateTo, search, typeFilter, settings);
    useEffect(() => {
        let cancelled = false;
        setSettingsLoading(true);
        setSettingsError(null);
        fetchWorkdaySettings()
            .then((dto) => {
            if (!cancelled)
                setSettings(workdayDtoToSettings(dto));
        })
            .catch((e) => {
            if (!cancelled) {
                setSettingsError(e instanceof Error ? e.message : 'Не удалось загрузить настройки');
                setSettings(DEFAULT_WORKDAY_SETTINGS);
            }
        })
            .finally(() => {
            if (!cancelled)
                setSettingsLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, []);
    const saveWorkdaySettings = useCallback(async (value: WorkdaySettings) => {
        const dto = await patchWorkdaySettings(settingsToWorkdayDto(value));
        setSettings(workdayDtoToSettings(dto));
        setSettingsError(null);
        await data.load();
    }, [data.load]);
    const singleDaySelected = Boolean(dateFrom && dateTo && dateFrom === dateTo);
    useEffect(() => {
        if (singleDaySelected && typeFilter === 'overtime')
            setTypeFilter('');
        if (!singleDaySelected && (typeFilter === 'present_on_time' || typeFilter === 'absent'))
            setTypeFilter('');
    }, [singleDaySelected, typeFilter]);
    const handleReset = useCallback(() => {
        setDateFrom(defaultFrom());
        setDateTo(defaultTo());
        setSearch('');
        setTypeFilter('');
    }, []);
    const handleExportExcel = useCallback(() => {
        exportAttendanceToCsv(data.filteredGroupedRecords, dateFrom, dateTo);
    }, [data.filteredGroupedRecords, dateFrom, dateTo]);
    const value = useMemo<AttendanceContextValue>(() => ({
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        search,
        setSearch,
        typeFilter,
        setTypeFilter,
        settings,
        settingsLoading,
        settingsError,
        saveWorkdaySettings,
        isSettingsOpen,
        setIsSettingsOpen,
        records: data.records,
        loading: data.loading,
        error: data.error,
        load: data.load,
        groupedRecords: data.groupedRecords,
        filteredGroupedRecords: data.filteredGroupedRecords,
        summary: data.summary,
        showTable: data.showTable,
        handleReset,
        handleExportExcel,
        typeFilterOptions: data.typeFilterOptions,
        isDailyMode: data.isDailyMode,
    }), [
        dateFrom,
        dateTo,
        search,
        typeFilter,
        settings,
        settingsLoading,
        settingsError,
        saveWorkdaySettings,
        isSettingsOpen,
        data,
        handleReset,
        handleExportExcel,
        data.typeFilterOptions,
        data.isDailyMode,
    ]);
    return (<AttendanceContext.Provider value={value}>
      {children}
    </AttendanceContext.Provider>);
}
