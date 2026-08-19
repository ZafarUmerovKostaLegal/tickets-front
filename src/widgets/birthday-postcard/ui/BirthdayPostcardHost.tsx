import { useCallback, useEffect, useState } from 'react';
import { useCurrentUser } from '@shared/hooks';
import { isAuthenticated } from '@shared/lib/auth';
import { isMeetingRoomAccount } from '@shared/lib/meetingRoomAccounts';
import {
    buildDemoBirthdayGreeting,
    consumeBirthdayGreeting,
    getPendingBirthdayGreeting,
    isBirthdayDemoForceEmail,
    type BirthdayGreetingPayload,
} from '../lib/birthdayGreetingStorage';
import {
    buildFirmAnniversaryGreeting,
    hasSeenFirmAnniversary,
    isFirmAnniversaryDate,
    markFirmAnniversarySeen,
} from '../lib/firmAnniversaryStorage';
import { BirthdayPostcardOverlay } from './BirthdayPostcardOverlay';

export function BirthdayPostcardHost() {
    const { user, loading } = useCurrentUser();
    const [greeting, setGreeting] = useState<BirthdayGreetingPayload | null>(null);
    const [dismissedDemo, setDismissedDemo] = useState(false);

    useEffect(() => {
        if (loading || !isAuthenticated() || !user?.email || isMeetingRoomAccount(user)) {
            setGreeting(null);
            return;
        }

        if (isBirthdayDemoForceEmail(user.email) && !dismissedDemo) {
            setGreeting(buildDemoBirthdayGreeting(user));
            return;
        }

        const now = new Date();
        if (isFirmAnniversaryDate(now) && !hasSeenFirmAnniversary(user.email, now.getFullYear())) {
            setGreeting(buildFirmAnniversaryGreeting(user, now));
            return;
        }

        setGreeting(getPendingBirthdayGreeting(user.email));
    }, [user, loading, dismissedDemo]);

    const handleClose = useCallback(() => {
        if (!greeting)
            return;
        if (greeting.id === 'bday_demo_force') {
            setDismissedDemo(true);
            setGreeting(null);
            return;
        }
        if (greeting.kind === 'firm') {
            markFirmAnniversarySeen(greeting.recipientEmail, new Date().getFullYear());
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
