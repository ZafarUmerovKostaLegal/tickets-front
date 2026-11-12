import { useCurrentUser } from '@shared/hooks';
import { isSnowfallUser } from '../lib/isSnowfallUser';
import { SnowfallOverlay } from './SnowfallOverlay';

export function SnowfallHost() {
    const { user, loading } = useCurrentUser();
    if (loading || !user || user.is_blocked || user.is_archived)
        return null;
    if (!isSnowfallUser(user))
        return null;
    return <SnowfallOverlay />;
}
