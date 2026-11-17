import { describe, expect, it } from 'vitest';
import type { HikvisionDeviceUsersResponse } from '../model/hikvisionTypes';
import { dedupeHikvisionUsers } from './dedupeHikvisionUsers';

const device = (camera_ip: string, users: unknown[], error?: string) =>
    ({ camera_ip, users, error } as unknown as HikvisionDeviceUsersResponse);

describe('dedupeHikvisionUsers', () => {
    it('merges the same employee seen by several cameras', () => {
        const res = dedupeHikvisionUsers([
            device('10.0.0.1', [{ employee_no: '7', name: 'Борис', department: '' }]),
            device('10.0.0.2', [{ employee_no: '7', name: 'Борис', department: 'Юристы' }]),
        ]);
        expect(res.cameraCount).toBe(2);
        expect(res.errors).toEqual([]);
        expect(res.users).toEqual([
            { employeeNo: '7', name: 'Борис', department: 'Юристы', cameras: ['10.0.0.1', '10.0.0.2'] },
        ]);
    });

    it('falls back to the name as a key and skips empty users', () => {
        const res = dedupeHikvisionUsers([
            device('cam', [{ name: 'Анна' }, { name: 'анна' }, { name: '   ' }, {}]),
        ]);
        expect(res.users).toHaveLength(1);
        expect(res.users[0]).toMatchObject({ employeeNo: '-', name: 'Анна', department: '-' });
    });

    it('collects camera errors and still counts the camera', () => {
        const res = dedupeHikvisionUsers([device('', [], 'timeout')]);
        expect(res.errors).toEqual(['Камера -: timeout']);
        expect(res.cameraCount).toBe(1);
        expect(res.users).toEqual([]);
    });

    it('sorts users alphabetically in Russian', () => {
        const res = dedupeHikvisionUsers([
            device('cam', [{ employee_no: '1', name: 'Яна' }, { employee_no: '2', name: 'Алексей' }, { employee_no: '3', name: 'ёлка' }]),
        ]);
        expect(res.users.map((u) => u.name)).toEqual(['Алексей', 'ёлка', 'Яна']);
    });
});
