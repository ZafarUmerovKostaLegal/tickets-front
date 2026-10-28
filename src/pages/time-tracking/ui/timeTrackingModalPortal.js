import { createPortal } from 'react-dom';
export function portalTimeTrackingModal(node) {
    return createPortal(node, document.body);
}
