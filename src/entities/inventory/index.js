export { EQUIPMENT_TIERS, equipmentTierByCode, isEquipmentClassCode, } from './model/equipmentClasses';
export { EQUIPMENT_SCORE_MAX, EQUIPMENT_SCORE_RANGES, EQUIPMENT_SCORE_POINTS, equipmentAgeYears, equipmentScoreFromAgeYears, equipmentScoreText, equipmentScoreTier, equipmentScoreTitle, equipmentScoreToClassCode, itemMatchesEquipmentScore, compareItemsByEquipmentScore, resolveEquipmentScore, } from './model/equipmentScore';
export { laptopRamUpgrade, parseRamGbFromNotes, } from './model/laptopRamUpgrade';
export { isMonitorCategory, parseMonitorDescription, formatMonitorDescription, monitorSpecsSummary, hasMonitorSpecs, EMPTY_MONITOR_SPECS, MONITOR_PORT_OPTIONS, MONITOR_RESOLUTION_PRESETS, } from './model/monitorSpecs';
export { buildInventoryItemExportText, buildInventoryItemExportFields, downloadInventoryItemCard, inventoryItemExportStem, processInventoryPhotoForExport, } from './lib/exportInventoryItemCard';
export { exportInventoryCategoryToExcel, fetchInventoryItemsForCategoryExport, buildInventoryCategoryExcelRows, } from './lib/exportInventoryCategoryExcel';
export { getStatuses, getCategories, getCategory, createCategory, updateCategory, deleteCategory, getItems, getItem, createItem, updateItem, uploadItemPhoto, assignItem, unassignItem, archiveItem, deleteItem, getItemPhotoUrl, } from './api';
