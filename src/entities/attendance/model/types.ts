export type AttendanceRecord = {
    camera_ip: string;
    person_id: string;
    name: string;
    department: string;
    time: string | null;
    checkpoint: string;
    attendance_status: string;
    door_no: number | null;
    label: string;
};
export type AttendanceQuery = {
    dateFrom: string;
    dateTo?: string;
    personId?: string;
    name?: string;
    department?: string;
    checkpoint?: string;
    status?: string;
    cameraIp?: string;
    maxRecordsPerDevice?: number;
    signal?: AbortSignal;
};
export type AttendanceByCamera = {
    camera_ip: string;
    error: string | null;
    records: Omit<AttendanceRecord, 'camera_ip'>[];
};
