export type HikvisionDeviceUsersResponse = {
    camera_ip?: string | null;
    error?: string | null;
    users?: HikvisionCameraUser[] | null;
};

export type HikvisionCameraUser = {
    employee_no?: string | null;
    name?: string | null;
    department?: string | null;
};

export type HikvisionUserBinding = {
    id: number;
    camera_employee_no: string;
    app_user_id: number;
    camera_name: string | null;
    created_at?: string;
    updated_at?: string;
};

export type HikvisionUserRow = {
    employeeNo: string;
    name: string;
    department: string;
    cameras: string[];
};

export type UpsertHikvisionMappingBody = {
    camera_employee_no: string;
    app_user_id: number;
    camera_name?: string | null;
};
