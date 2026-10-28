export function dedupeHikvisionUsers(devices) {
    const uniq = new Map();
    const errors = [];
    const cameraIps = new Set();
    for (const device of devices) {
        const cameraIp = (device.camera_ip || '-').trim() || '-';
        cameraIps.add(cameraIp);
        if (device.error) {
            errors.push(`Камера ${cameraIp}: ${device.error}`);
            continue;
        }
        for (const user of device.users || []) {
            const employeeNo = (user.employee_no || '').trim();
            const name = (user.name || '').trim();
            const key = employeeNo ? `emp:${employeeNo}` : `name:${name.toLowerCase()}`;
            if (!key || key === 'name:')
                continue;
            const existing = uniq.get(key);
            if (!existing) {
                uniq.set(key, {
                    employeeNo: employeeNo || '-',
                    name: name || '-',
                    department: (user.department || '').trim() || '-',
                    cameras: [cameraIp],
                });
                continue;
            }
            if (!existing.cameras.includes(cameraIp))
                existing.cameras.push(cameraIp);
            if (existing.department === '-' && (user.department || '').trim())
                existing.department = (user.department || '').trim();
            if (existing.name === '-' && name)
                existing.name = name;
        }
    }
    const users = [...uniq.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' }));
    return { users, cameraCount: cameraIps.size, errors };
}
