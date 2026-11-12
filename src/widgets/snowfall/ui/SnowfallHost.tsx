import { useEffect } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { isSnowfallUser } from '../lib/isSnowfallUser';
import { SnowfallOverlay } from './SnowfallOverlay';

export function SnowfallHost() {
    const { user, loading } = useCurrentUser();
    const enabled = !loading
        && Boolean(user)
        && !user?.is_blocked
        && !user?.is_archived
        && isSnowfallUser(user);

    useEffect(() => {
        if (!enabled) {
            document.body.removeAttribute('data-snowfall');
            return;
        }
        document.body.setAttribute('data-snowfall', '1');
        return () => {
            document.body.removeAttribute('data-snowfall');
        };
    }, [enabled]);

    if (!enabled)
        return null;
    return <SnowfallOverlay />;
}
