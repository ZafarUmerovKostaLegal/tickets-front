import type { AttendanceByCamera, AttendanceRecord } from '../model/types';
function toRecord(cameraIp: string, r: Omit<AttendanceRecord, 'camera_ip'>): AttendanceRecord {
    return {
        camera_ip: cameraIp,
        person_id: r.person_id,
        name: r.name,
        department: r.department,
        time: r.time,
        checkpoint: r.checkpoint,
        attendance_status: r.attendance_status,
        door_no: r.door_no,
        label: r.label,
    };
}
export function flattenAttendanceByCamera(data: AttendanceByCamera[]): AttendanceRecord[] {
    const result: AttendanceRecord[] = [];
    for (const cam of data) {
        const records = cam?.records;
        if (!Array.isArray(records))
            continue;
        for (const r of records) {
            result.push(toRecord(cam.camera_ip, r));
        }
    }
    return result;
}
