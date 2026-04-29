import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
export function portalTimeTrackingModal(node: ReactNode) {
    return createPortal(node, document.body);
}
