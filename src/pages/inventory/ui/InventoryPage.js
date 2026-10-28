import { jsx as _jsx } from "react/jsx-runtime";
import { InventoryProvider } from '../model';
import { InventoryPageView } from './InventoryPageView';
export function InventoryPage() {
    return (_jsx(InventoryProvider, { children: _jsx(InventoryPageView, {}) }));
}
