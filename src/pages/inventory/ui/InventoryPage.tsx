import { InventoryProvider } from '../model';
import { InventoryPageView } from './InventoryPageView';
export function InventoryPage() {
    return (<InventoryProvider>
      <InventoryPageView />
    </InventoryProvider>);
}
