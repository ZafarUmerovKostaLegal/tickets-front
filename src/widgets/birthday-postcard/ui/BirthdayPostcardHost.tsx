import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { isAuthenticated } from '@shared/lib/auth';
import {
    buildDemoBirthdayGreeting,
    consumeBirthdayGreeting,
    getPendingBirthdayGreeting,
    isBirthdayDemoForceEmail,
    type BirthdayGreetingPayload,
} from '../lib/birthdayGreetingStorage';
import { BirthdayPostcardOverlay } from './BirthdayPostcardOverlay';

export function BirthdayPostcardHost() {
    const { user, loading } = useCurrentUser();
    const [greeting, setGreeting] = useState<BirthdayGreetingPayload | null>(null);
    const [dismissedDemo, setDismissedDemo] = useState(false);

    useEffect(() => {
        if (loading || !isAuthenticated() || !user?.email) {
            setGreeting(null);
            return;
        }

        if (isBirthdayDemoForceEmail(user.email) && !dismissedDemo) {
            setGreeting(buildDemoBirthdayGreeting(user));
            return;
        }

        const pending = getPendingBirthdayGreeting(user.email);
        setGreeting(pending);
    }, [user, loading, dismissedDemo]);

    const handleClose = useCallback(() => {
        if (!greeting)
            return;
        if (greeting.id === 'bday_demo_force') {
            setDismissedDemo(true);
            setGreeting(null);
            return;
        }
        consumeBirthdayGreeting(greeting.id);
        setGreeting(null);
    }, [greeting]);

    if (!greeting)
        return null;

    return <BirthdayPostcardOverlay greeting={greeting} onClose={handleClose} />;
}
