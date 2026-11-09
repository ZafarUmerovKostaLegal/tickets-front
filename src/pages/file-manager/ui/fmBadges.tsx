import { filesApi } from '../api/filesApi';
import { useLoad } from './fmShared';

export function AccessRequestsBadge({ tick }: { tick: number }) {
    const load = useLoad(() => filesApi.requests('pending'), [tick]);
    const count = load.data?.requests.length ?? 0;
    return count ? <em className="is-alert">{count}</em> : null;
}
