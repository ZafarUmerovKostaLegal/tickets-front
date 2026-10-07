import { getPublicGatewayAssetUrl } from '@shared/api';
export function resolveDesktopBackgroundDisplayUrl(path) {
    return getPublicGatewayAssetUrl(path);
}
