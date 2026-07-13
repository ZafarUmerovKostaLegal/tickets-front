import { getPublicGatewayAssetUrl } from '@shared/api';


export function resolveDesktopBackgroundDisplayUrl(path: string | null | undefined): string | null {
    return getPublicGatewayAssetUrl(path);
}
