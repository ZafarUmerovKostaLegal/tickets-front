export type { AttendanceRecord, AttendanceQuery } from './model/types';
export type { AttendanceStatus, DailyAttendanceItem, DailyAttendanceResponse, } from './model/dailyReportTypes';
export type {
    HikvisionDeviceUsersResponse,
    HikvisionCameraUser,
    HikvisionUserBinding,
    HikvisionUserRow,
    UpsertHikvisionMappingBody,
} from './model/hikvisionTypes';
export type { WorkdaySettingsDto } from './model/workdaySettingsTypes';
export { workdayDtoToSettings, settingsToWorkdayDto } from './lib/workdaySettingsMap';
export { dedupeHikvisionUsers } from './lib/dedupeHikvisionUsers';
export { getAttendanceApiUrl, getAttendanceResolvedBaseUrl } from './lib/config';
export type { UploadAttendanceExplanationParams, AttendanceRangeMarker, AttendanceRangeReportResponse } from './api';
export {
    fetchAttendance,
    fetchDailyAttendanceReport,
    fetchAttendanceRangeReport,
    fetchWorkdaySettings,
    patchWorkdaySettings,
    uploadAttendanceExplanation,
    fetchHikvisionUsers,
    listHikvisionMappings,
    upsertHikvisionMapping,
    deleteHikvisionMapping,
} from './api';
