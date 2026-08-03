import { describe, expect, it } from 'vitest';
import {
    isMeetingRoomAccount,
    isMeetingRoomAccountEmail,
    isMeetingRoomAllowedPath,
} from './meetingRoomAccounts';

describe('meetingRoomAccounts', () => {
    it('recognizes both meeting-room emails', () => {
        expect(isMeetingRoomAccountEmail('smallmeetingroom@kostalegal.com')).toBe(true);
        expect(isMeetingRoomAccountEmail('LargeMeetingRoom@KostaLegal.com')).toBe(true);
        expect(isMeetingRoomAccountEmail('user@kostalegal.com')).toBe(false);
        expect(isMeetingRoomAccount({ email: 'smallmeetingroom@kostalegal.com' })).toBe(true);
    });

    it('allows only home and call-schedule paths', () => {
        expect(isMeetingRoomAllowedPath('/home')).toBe(true);
        expect(isMeetingRoomAllowedPath('/call-schedule')).toBe(true);
        expect(isMeetingRoomAllowedPath('/tickets')).toBe(false);
        expect(isMeetingRoomAllowedPath('/admin')).toBe(false);
        expect(isMeetingRoomAllowedPath('/kosta-legal-ai')).toBe(false);
    });
});
