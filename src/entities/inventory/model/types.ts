export type InventoryStatusItem = {
    value: string;
    label: string;
};
export type InventoryCategory = {
    id: number;
    name: string;
    description: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
};
export type InventoryItem = {
    id: number;
    uuid: string;
    name: string;
    description: string | null;
    category_id: number;
    photo_path: string | null;
    serial_number: string | null;
    inventory_number: string;
    status: 'in_use' | 'in_stock' | 'repair' | 'written_off';
    assigned_to_user_id: number | null;
    assigned_at: string | null;
    purchase_date: string | null;
    warranty_until: string | null;
    created_at: string;
    updated_at: string;
    is_archived: boolean;
};
export type CreateCategoryBody = {
    name: string;
    description?: string;
    sort_order?: number;
};
export type UpdateCategoryBody = {
    name?: string;
    description?: string;
    sort_order?: number;
};
export type UpdateItemBody = {
    name?: string;
    description?: string;
    category_id?: number;
    serial_number?: string;
    status?: string;
    purchase_date?: string;
    warranty_until?: string;
};
export type ItemsParams = {
    skip?: number;
    limit?: number;
    category_id?: number;
    status?: string;
    assigned_to_user_id?: number;
    include_archived?: boolean;
};
