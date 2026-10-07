import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, } from 'react';
import { getStatuses, getCategories, getItems, createCategory, updateCategory, deleteCategory, createItem, updateItem, uploadItemPhoto, assignItem, unassignItem, archiveItem, deleteItem, getItemPhotoUrl, isEquipmentClassCode, itemMatchesEquipmentScore, compareItemsByEquipmentScore, formatMonitorDescription, isMonitorCategory, parseMonitorDescription, } from '@entities/inventory';
import { getUsers } from '@entities/user';
import { useCurrentUser } from '@shared/hooks';
import { isHiddenSystemUser } from '@shared/lib';
import { toDateInput } from '@shared/lib/formatDate';
import { LIMIT, canEditInventory, canCreateInventoryItem, canManageCategories } from './constants';
const defaultItemForm = {
    name: '',
    category_id: '',
    inventory_number: '',
    description: '',
    serial_number: '',
    equipment_class: '',
    status: 'in_stock',
    purchase_date: '',
    warranty_until: '',
    monitor_diagonal: '',
    monitor_resolution: '',
    monitor_refresh_hz: '',
    monitor_panel: '',
    monitor_ports: [],
    monitor_vesa: '',
    monitor_curved: '',
};
function monitorSpecsFromForm(form) {
    return {
        diagonalIn: form.monitor_diagonal,
        resolution: form.monitor_resolution,
        refreshHz: form.monitor_refresh_hz,
        panel: form.monitor_panel,
        ports: form.monitor_ports,
        vesa: form.monitor_vesa,
        curved: form.monitor_curved,
    };
}
function formPatchFromMonitorDescription(description) {
    const parsed = parseMonitorDescription(description);
    return {
        description: parsed.notes,
        monitor_diagonal: parsed.specs.diagonalIn,
        monitor_resolution: parsed.specs.resolution,
        monitor_refresh_hz: parsed.specs.refreshHz,
        monitor_panel: parsed.specs.panel,
        monitor_ports: parsed.specs.ports,
        monitor_vesa: parsed.specs.vesa,
        monitor_curved: parsed.specs.curved,
    };
}
const InventoryContext = createContext(null);
export function useInventory() {
    const ctx = useContext(InventoryContext);
    if (!ctx)
        throw new Error('useInventory must be used within InventoryProvider');
    return ctx;
}
export function InventoryProvider({ children }) {
    const { user } = useCurrentUser();
    const canEdit = canEditInventory(user?.role);
    const canManageCats = canManageCategories(user?.role);
    const canCreateItems = canCreateInventoryItem(user?.role);
    const [categories, setCategories] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [users, setUsers] = useState([]);
    const [items, setItems] = useState([]);
    const [loadingCat, setLoadingCat] = useState(true);
    const [loadingItems, setLoadingItems] = useState(true);
    const [error, setError] = useState(null);
    const [filterCategoryId, setFilterCategoryId] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterEquipmentClass, setFilterEquipmentClass] = useState('');
    const [filterScore, setFilterScore] = useState('');
    const [scoreSort, setScoreSort] = useState('');
    const [filterAssignedTo, setFilterAssignedTo] = useState('');
    const [includeArchived, setIncludeArchived] = useState(false);
    const [skip, setSkip] = useState(0);
    const [itemsTotal, setItemsTotal] = useState(0);
    const [inUseCount, setInUseCount] = useState(0);
    const [inStockCount, setInStockCount] = useState(0);
    const [archivedCount, setArchivedCount] = useState(0);
    const [categoryModal, setCategoryModal] = useState(null);
    const [itemModal, setItemModal] = useState(null);
    const [assignModal, setAssignModal] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [itemForm, setItemForm] = useState(defaultItemForm);
    const [itemPhotoFile, setItemPhotoFile] = useState(null);
    const [assignUserId, setAssignUserId] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const photoInputRef = useRef(null);
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
            const list = await getUsers();
            setUsers(list.filter((u) => !isHiddenSystemUser(u)));
        }
        catch {
            setUsers([]);
        }
    }, [canEdit]);
    const loadItems = useCallback(async (signal) => {
        setLoadingItems(true);
        setError(null);
        try {
            const scoreFilter = typeof filterScore === 'number' && filterScore >= 1 && filterScore <= 10
                ? filterScore
                : null;
            const sortOrder = scoreSort === 'asc' || scoreSort === 'desc' ? scoreSort : null;
            // Score filter/sort are computed client-side from purchase_date / class — fetch a wide page.
            const clientScoreMode = scoreFilter != null || sortOrder != null;
            const page = await getItems({
                skip: clientScoreMode ? 0 : skip,
                limit: clientScoreMode ? 200 : LIMIT,
                category_id: filterCategoryId || undefined,
                status: filterStatus || undefined,
                equipment_class: (!clientScoreMode && filterEquipmentClass && isEquipmentClassCode(filterEquipmentClass)
                    ? filterEquipmentClass
                    : undefined),
                assigned_to_user_id: filterAssignedTo || undefined,
                include_archived: includeArchived,
            }, signal);
            if (clientScoreMode) {
                let matched = scoreFilter != null
                    ? page.items.filter((item) => itemMatchesEquipmentScore(item, scoreFilter))
                    : [...page.items];
                if (sortOrder != null)
                    matched = matched.sort((a, b) => compareItemsByEquipmentScore(a, b, sortOrder));
                setItems(matched.slice(skip, skip + LIMIT));
                setItemsTotal(matched.length);
            }
            else {
                setItems(page.items);
                setItemsTotal(page.total);
            }
            setInUseCount(page.in_use_count);
            setInStockCount(page.in_stock_count);
            setArchivedCount(page.archived_count);
        }
        catch (e) {
            if (signal?.aborted)
                return;
            setError(e instanceof Error ? e.message : 'Ошибка загрузки позиций');
            setItems([]);
            setItemsTotal(0);
            setInUseCount(0);
            setInStockCount(0);
            setArchivedCount(0);
        }
        finally {
            if (!signal?.aborted)
                setLoadingItems(false);
        }
    }, [skip, filterCategoryId, filterStatus, filterEquipmentClass, filterScore, scoreSort, filterAssignedTo, includeArchived]);
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
        const controller = new AbortController();
        void loadItems(controller.signal);
        return () => controller.abort();
    }, [loadItems]);
    const handleCategorySubmit = useCallback(async (e) => {
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
    const handleDeleteCategory = useCallback(async (id) => {
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
    const handleItemSubmit = useCallback(async (e) => {
        e.preventDefault();
        setFormError(null);
        const classRaw = itemForm.equipment_class.trim().toUpperCase();
        if (classRaw && !isEquipmentClassCode(classRaw)) {
            setFormError('Оценка техники: выберите один из диапазонов баллов');
            return;
        }
        const equipmentClass = classRaw && isEquipmentClassCode(classRaw) ? classRaw : null;
        const categoryName = categories.find((c) => c.id === itemForm.category_id)?.name ?? '';
        const description = isMonitorCategory(categoryName)
            ? formatMonitorDescription(monitorSpecsFromForm(itemForm), itemForm.description)
            : itemForm.description.trim();
        setSubmitting(true);
        try {
            if (itemModal === 'add') {
                const form = new FormData();
                form.append('name', itemForm.name.trim());
                form.append('category_id', String(itemForm.category_id));
                form.append('inventory_number', itemForm.inventory_number.trim());
                if (description)
                    form.append('description', description);
                if (itemForm.serial_number.trim())
                    form.append('serial_number', itemForm.serial_number.trim());
                if (equipmentClass)
                    form.append('equipment_class', equipmentClass);
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
                    inventory_number: itemForm.inventory_number.trim() || undefined,
                    description: description || undefined,
                    serial_number: itemForm.serial_number.trim() || undefined,
                    equipment_class: equipmentClass,
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
    }, [itemModal, itemForm, itemPhotoFile, categories, resetItemForm, loadItems]);
    const handleAssignSubmit = useCallback(async (e) => {
        e.preventDefault();
        if (!assignModal || assignUserId === '')
            return;
        setFormError(null);
        setSubmitting(true);
        try {
            await assignItem(assignModal.uuid, assignUserId);
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
    const handleUnassign = useCallback(async (item) => {
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
    const handleArchive = useCallback(async (item, is_archived) => {
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
    const handleDeleteItem = useCallback(async (uuid) => {
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
    const openEditItem = useCallback((item) => {
        setFormError(null);
        const monitorPatch = formPatchFromMonitorDescription(item.description);
        setItemForm({
            name: item.name,
            category_id: item.category_id,
            inventory_number: item.inventory_number,
            serial_number: item.serial_number || '',
            equipment_class: item.equipment_class || '',
            status: item.status,
            purchase_date: toDateInput(item.purchase_date),
            warranty_until: toDateInput(item.warranty_until),
            ...monitorPatch,
        });
        setItemPhotoFile(null);
        setItemModal({ uuid: item.uuid });
    }, []);
    const categoryById = useCallback((id) => categories.find((c) => c.id === id), [categories]);
    const statusLabel = useCallback((value) => statuses.find((s) => s.value === value)?.label ?? value, [statuses]);
    const totalItems = itemsTotal;
    const countByCategory = useMemo(() => {
        const acc = {};
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
    const value = useMemo(() => ({
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
        filterEquipmentClass,
        setFilterEquipmentClass,
        filterScore,
        setFilterScore,
        scoreSort,
        setScoreSort,
        filterAssignedTo,
        setFilterAssignedTo,
        includeArchived,
        setIncludeArchived,
        skip,
        setSkip,
        itemsTotal,
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
        filterEquipmentClass,
        filterScore,
        scoreSort,
        filterAssignedTo,
        includeArchived,
        skip,
        itemsTotal,
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
    return _jsx(InventoryContext.Provider, { value: value, children: children });
}
