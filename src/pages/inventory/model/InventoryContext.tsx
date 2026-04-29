import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode, } from 'react';
import { getStatuses, getCategories, getItems, createCategory, updateCategory, deleteCategory, createItem, updateItem, uploadItemPhoto, assignItem, unassignItem, archiveItem, deleteItem, getItemPhotoUrl, type InventoryCategory, type InventoryItem, type InventoryStatusItem, } from '@entities/inventory';
import { getUsers, type User } from '@entities/user';
import { useCurrentUser } from '@shared/hooks';
import { toDateInput } from '@shared/lib/formatDate';
import { LIMIT, canEditInventory, canCreateInventoryItem, canManageCategories } from './constants';
type CategoryModal = 'add' | {
    id: number;
} | null;
type ItemModal = 'add' | {
    uuid: string;
} | null;
type DeleteTarget = {
    type: 'category';
    id: number;
} | {
    type: 'item';
    uuid: string;
} | null;
type InventoryContextValue = {
    user: User | null;
    canEdit: boolean;
    canManageCats: boolean;
    canCreateItems: boolean;
    categories: InventoryCategory[];
    statuses: InventoryStatusItem[];
    users: User[];
    items: InventoryItem[];
    loadingCat: boolean;
    loadingItems: boolean;
    error: string | null;
    filterCategoryId: number | '';
    setFilterCategoryId: (v: number | '') => void;
    filterStatus: string;
    setFilterStatus: (v: string) => void;
    filterAssignedTo: number | '';
    setFilterAssignedTo: (v: number | '') => void;
    includeArchived: boolean;
    setIncludeArchived: (v: boolean) => void;
    skip: number;
    setSkip: (v: number | ((prev: number) => number)) => void;
    categoryModal: CategoryModal;
    setCategoryModal: (v: CategoryModal) => void;
    itemModal: ItemModal;
    setItemModal: (v: ItemModal) => void;
    assignModal: InventoryItem | null;
    setAssignModal: (v: InventoryItem | null) => void;
    deleteTarget: DeleteTarget;
    setDeleteTarget: (v: DeleteTarget) => void;
    categoryForm: {
        name: string;
        description: string;
    };
    setCategoryForm: (v: {
        name: string;
        description: string;
    } | ((prev: {
        name: string;
        description: string;
    }) => {
        name: string;
        description: string;
    })) => void;
    itemForm: {
        name: string;
        category_id: number | '';
        inventory_number: string;
        description: string;
        serial_number: string;
        status: string;
        purchase_date: string;
        warranty_until: string;
    };
    setItemForm: (v: typeof defaultItemForm | ((prev: typeof defaultItemForm) => typeof defaultItemForm)) => void;
    itemPhotoFile: File | null;
    setItemPhotoFile: (v: File | null) => void;
    assignUserId: number | '';
    setAssignUserId: (v: number | '') => void;
    submitting: boolean;
    formError: string | null;
    setFormError: (v: string | null) => void;
    photoInputRef: React.RefObject<HTMLInputElement | null>;
    loadCategories: () => Promise<void>;
    loadItems: () => Promise<void>;
    handleCategorySubmit: (e: React.FormEvent) => Promise<void>;
    handleDeleteCategory: (id: number) => Promise<void>;
    handleItemSubmit: (e: React.FormEvent) => Promise<void>;
    handleAssignSubmit: (e: React.FormEvent) => Promise<void>;
    handleUnassign: (item: InventoryItem) => Promise<void>;
    handleArchive: (item: InventoryItem, is_archived: boolean) => Promise<void>;
    handleDeleteItem: (uuid: string) => Promise<void>;
    resetItemForm: () => void;
    openEditItem: (item: InventoryItem) => void;
    categoryById: (id: number) => InventoryCategory | undefined;
    statusLabel: (value: string) => string;
    getItemPhotoUrl: typeof getItemPhotoUrl;
    totalItems: number;
    inUseCount: number;
    inStockCount: number;
    archivedCount: number;
    countByCategory: Record<number, number>;
    sortedCategories: InventoryCategory[];
};
const defaultItemForm = {
    name: '',
    category_id: '' as number | '',
    inventory_number: '',
    description: '',
    serial_number: '',
    status: 'in_stock',
    purchase_date: '',
    warranty_until: '',
};
const InventoryContext = createContext<InventoryContextValue | null>(null);
export function useInventory() {
    const ctx = useContext(InventoryContext);
    if (!ctx)
        throw new Error('useInventory must be used within InventoryProvider');
    return ctx;
}
type InventoryProviderProps = {
    children: ReactNode;
};
export function InventoryProvider({ children }: InventoryProviderProps) {
    const { user } = useCurrentUser();
    const canEdit = canEditInventory(user?.role);
    const canManageCats = canManageCategories(user?.role);
    const canCreateItems = canCreateInventoryItem(user?.role);
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [statuses, setStatuses] = useState<InventoryStatusItem[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loadingCat, setLoadingCat] = useState(true);
    const [loadingItems, setLoadingItems] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterCategoryId, setFilterCategoryId] = useState<number | ''>('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterAssignedTo, setFilterAssignedTo] = useState<number | ''>('');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [skip, setSkip] = useState(0);
    const [categoryModal, setCategoryModal] = useState<CategoryModal>(null);
    const [itemModal, setItemModal] = useState<ItemModal>(null);
    const [assignModal, setAssignModal] = useState<InventoryItem | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [itemForm, setItemForm] = useState(defaultItemForm);
    const [itemPhotoFile, setItemPhotoFile] = useState<File | null>(null);
    const [assignUserId, setAssignUserId] = useState<number | ''>('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const loadCategories = useCallback(async () => {
        setLoadingCat(true);
        setError(null);
        try {
            setCategories(await getCategories());
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки категорий');
        }
        finally {
            setLoadingCat(false);
        }
    }, []);
    const loadStatuses = useCallback(async () => {
        try {
            setStatuses(await getStatuses());
        }
        catch {
            setStatuses([]);
        }
    }, []);
    const loadUsers = useCallback(async () => {
        if (!canEdit)
            return;
        try {
            setUsers(await getUsers());
        }
        catch {
            setUsers([]);
        }
    }, [canEdit]);
    const loadItems = useCallback(async () => {
        setLoadingItems(true);
        setError(null);
        try {
            setItems(await getItems({
                skip,
                limit: LIMIT,
                category_id: filterCategoryId || undefined,
                status: filterStatus || undefined,
                assigned_to_user_id: filterAssignedTo || undefined,
                include_archived: includeArchived,
            }));
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Ошибка загрузки позиций');
            setItems([]);
        }
        finally {
            setLoadingItems(false);
        }
    }, [skip, filterCategoryId, filterStatus, filterAssignedTo, includeArchived]);
    useEffect(() => {
        loadCategories();
    }, [loadCategories]);
    useEffect(() => {
        loadStatuses();
    }, [loadStatuses]);
    useEffect(() => {
        loadUsers();
    }, [loadUsers]);
    useEffect(() => {
        loadItems();
    }, [loadItems]);
    const handleCategorySubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setSubmitting(true);
        try {
            if (categoryModal === 'add') {
                await createCategory({ name: categoryForm.name.trim(), description: categoryForm.description.trim() || undefined });
                setCategoryModal(null);
                setCategoryForm({ name: '', description: '' });
                loadCategories();
            }
            else if (categoryModal && 'id' in categoryModal) {
                await updateCategory(categoryModal.id, { name: categoryForm.name.trim(), description: categoryForm.description.trim() || undefined });
                setCategoryModal(null);
                loadCategories();
            }
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка');
        }
        finally {
            setSubmitting(false);
        }
    }, [categoryModal, categoryForm, loadCategories]);
    const handleDeleteCategory = useCallback(async (id: number) => {
        setSubmitting(true);
        setFormError(null);
        try {
            await deleteCategory(id);
            setDeleteTarget(null);
            loadCategories();
            loadItems();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка удаления');
        }
        finally {
            setSubmitting(false);
        }
    }, [loadCategories, loadItems]);
    const resetItemForm = useCallback(() => {
        setItemForm(defaultItemForm);
        setItemPhotoFile(null);
    }, []);
    const handleItemSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError(null);
        setSubmitting(true);
        try {
            if (itemModal === 'add') {
                const form = new FormData();
                form.append('name', itemForm.name.trim());
                form.append('category_id', String(itemForm.category_id));
                form.append('inventory_number', itemForm.inventory_number.trim());
                if (itemForm.description.trim())
                    form.append('description', itemForm.description.trim());
                if (itemForm.serial_number.trim())
                    form.append('serial_number', itemForm.serial_number.trim());
                form.append('status', itemForm.status);
                if (itemForm.purchase_date)
                    form.append('purchase_date', new Date(itemForm.purchase_date).toISOString());
                if (itemForm.warranty_until)
                    form.append('warranty_until', new Date(itemForm.warranty_until).toISOString());
                if (itemPhotoFile)
                    form.append('photo', itemPhotoFile);
                await createItem(form);
                setItemModal(null);
                resetItemForm();
                loadItems();
            }
            else if (itemModal && 'uuid' in itemModal) {
                await updateItem(itemModal.uuid, {
                    name: itemForm.name.trim(),
                    category_id: itemForm.category_id || undefined,
                    description: itemForm.description.trim() || undefined,
                    serial_number: itemForm.serial_number.trim() || undefined,
                    status: itemForm.status,
                    purchase_date: itemForm.purchase_date ? new Date(itemForm.purchase_date).toISOString() : undefined,
                    warranty_until: itemForm.warranty_until ? new Date(itemForm.warranty_until).toISOString() : undefined,
                });
                if (itemPhotoFile)
                    await uploadItemPhoto(itemModal.uuid, itemPhotoFile);
                setItemModal(null);
                resetItemForm();
                loadItems();
            }
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка');
        }
        finally {
            setSubmitting(false);
        }
    }, [itemModal, itemForm, itemPhotoFile, resetItemForm, loadItems]);
    const handleAssignSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!assignModal || assignUserId === '')
            return;
        setFormError(null);
        setSubmitting(true);
        try {
            await assignItem(assignModal.uuid, assignUserId as number);
            setAssignModal(null);
            setAssignUserId('');
            loadItems();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка закрепления');
        }
        finally {
            setSubmitting(false);
        }
    }, [assignModal, assignUserId, loadItems]);
    const handleUnassign = useCallback(async (item: InventoryItem) => {
        setSubmitting(true);
        setFormError(null);
        try {
            await unassignItem(item.uuid);
            loadItems();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка открепления');
        }
        finally {
            setSubmitting(false);
        }
    }, [loadItems]);
    const handleArchive = useCallback(async (item: InventoryItem, is_archived: boolean) => {
        setSubmitting(true);
        setFormError(null);
        try {
            await archiveItem(item.uuid, is_archived);
            loadItems();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка');
        }
        finally {
            setSubmitting(false);
        }
    }, [loadItems]);
    const handleDeleteItem = useCallback(async (uuid: string) => {
        setSubmitting(true);
        setFormError(null);
        try {
            await deleteItem(uuid);
            setDeleteTarget(null);
            loadItems();
        }
        catch (err) {
            setFormError(err instanceof Error ? err.message : 'Ошибка удаления');
        }
        finally {
            setSubmitting(false);
        }
    }, [loadItems]);
    const openEditItem = useCallback((item: InventoryItem) => {
        setItemForm({
            name: item.name,
            category_id: item.category_id,
            inventory_number: item.inventory_number,
            description: item.description || '',
            serial_number: item.serial_number || '',
            status: item.status,
            purchase_date: toDateInput(item.purchase_date),
            warranty_until: toDateInput(item.warranty_until),
        });
        setItemPhotoFile(null);
        setItemModal({ uuid: item.uuid });
    }, []);
    const categoryById = useCallback((id: number) => categories.find((c) => c.id === id), [categories]);
    const statusLabel = useCallback((value: string) => statuses.find((s) => s.value === value)?.label ?? value, [statuses]);
    const totalItems = items.length;
    const inUseCount = items.filter((i) => i.status === 'in_use' && !i.is_archived).length;
    const inStockCount = items.filter((i) => i.status === 'in_stock' && !i.is_archived).length;
    const archivedCount = items.filter((i) => i.is_archived).length;
    const countByCategory = useMemo(() => {
        const acc: Record<number, number> = {};
        items.forEach((i) => {
            acc[i.category_id] = (acc[i.category_id] || 0) + 1;
        });
        return acc;
    }, [items]);
    const sortedCategories = useMemo(() => [...categories].sort((a, b) => {
        if (a.sort_order !== b.sort_order)
            return a.sort_order - b.sort_order;
        return a.name.localeCompare(b.name, 'ru');
    }), [categories]);
    const value: InventoryContextValue = useMemo(() => ({
        user: user ?? null,
        canEdit,
        canManageCats,
        canCreateItems,
        categories,
        statuses,
        users,
        items,
        loadingCat,
        loadingItems,
        error,
        filterCategoryId,
        setFilterCategoryId,
        filterStatus,
        setFilterStatus,
        filterAssignedTo,
        setFilterAssignedTo,
        includeArchived,
        setIncludeArchived,
        skip,
        setSkip,
        categoryModal,
        setCategoryModal,
        itemModal,
        setItemModal,
        assignModal,
        setAssignModal,
        deleteTarget,
        setDeleteTarget,
        categoryForm,
        setCategoryForm,
        itemForm,
        setItemForm,
        itemPhotoFile,
        setItemPhotoFile,
        assignUserId,
        setAssignUserId,
        submitting,
        formError,
        setFormError,
        photoInputRef,
        loadCategories,
        loadItems,
        handleCategorySubmit,
        handleDeleteCategory,
        handleItemSubmit,
        handleAssignSubmit,
        handleUnassign,
        handleArchive,
        handleDeleteItem,
        resetItemForm,
        openEditItem,
        categoryById,
        statusLabel,
        getItemPhotoUrl,
        totalItems,
        inUseCount,
        inStockCount,
        archivedCount,
        countByCategory,
        sortedCategories,
    }), [
        user,
        canEdit,
        canManageCats,
        canCreateItems,
        categories,
        statuses,
        users,
        items,
        loadingCat,
        loadingItems,
        error,
        filterCategoryId,
        filterStatus,
        filterAssignedTo,
        includeArchived,
        skip,
        categoryModal,
        itemModal,
        assignModal,
        deleteTarget,
        categoryForm,
        itemForm,
        itemPhotoFile,
        assignUserId,
        submitting,
        formError,
        loadCategories,
        loadItems,
        handleCategorySubmit,
        handleDeleteCategory,
        handleItemSubmit,
        handleAssignSubmit,
        handleUnassign,
        handleArchive,
        handleDeleteItem,
        resetItemForm,
        openEditItem,
        categoryById,
        statusLabel,
        totalItems,
        inUseCount,
        inStockCount,
        archivedCount,
        countByCategory,
        sortedCategories,
    ]);
    return <InventoryContext.Provider value={value}>{children}</InventoryContext.Provider>;
}
