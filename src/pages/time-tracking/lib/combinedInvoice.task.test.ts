import { describe, expect, it } from 'vitest';
import { applyLinkedTaskNames, combinedTimeTaskAndNotes, type CombinedReportSnapshot } from './combinedInvoice';

function report(task: string, description: string): CombinedReportSnapshot {
    return {
        feeTitle: 'TIME REPORT FOR SERVICES PROVIDED IN SEPTEMBER 2026',
        currency: 'USD',
        projects: [{
            name: 'BESSX5',
            lines: [{
                date: '2026-09-21',
                user: 'Shukhrat Yunusov',
                initials: 'SHMYU',
                task,
                description,
                hours: 0.75,
                rate: 320,
                amount: 240,
            }],
        }],
        people: [],
        expenses: [],
        shares: [],
        totalHours: 0.75,
        totalFees: 240,
        totalExpenses: 0,
    };
}

describe('combinedTimeTaskAndNotes', () => {
    it('uses the linked task and keeps the note', () => {
        const split = combinedTimeTaskAndNotes('Attending CP call.', 'Telephone calls');
        expect(split.task).toBe('Telephone calls');
        expect(split.description).toBe('Attending CP call.');
    });

    it('does not copy a note into Task when the task name is missing', () => {
        const split = combinedTimeTaskAndNotes('IA review');
        expect(split.task).toBe('');
        expect(split.description).toBe('IA review');
    });
});

describe('applyLinkedTaskNames', () => {
    it('replaces a description copied into Task and leaves hours and amount', () => {
        const next = applyLinkedTaskNames(report('Attending CP call.', 'Attending CP call.'), [{
            workDate: '2026-09-21',
            hours: 0.75,
            description: 'Telephone calls\nAttending CP call.',
            taskName: 'Telephone calls',
        }]);
        const line = next.projects[0]?.lines[0];
        expect(line?.task).toBe('Telephone calls');
        expect(line?.description).toBe('Attending CP call.');
        expect(line?.hours).toBe(0.75);
        expect(line?.amount).toBe(240);
    });

    it('replaces IA review and BSSA review notes used as tasks', () => {
        const base = report('IA review', 'IA review');
        base.projects[0]!.lines.push({
            date: '2026-09-23',
            user: 'Name',
            initials: 'MNI',
            task: 'BSSA review',
            description: 'BSSA review',
            hours: 1.07,
            rate: 120,
            amount: 128.4,
        });
        const next = applyLinkedTaskNames(base, [
            { workDate: '2026-09-21', hours: 0.75, description: 'IA review', taskName: 'Document Review' },
            { workDate: '2026-09-23', hours: 1.07, description: 'BSSA review', taskName: 'Drafting' },
        ]);
        expect(next.projects[0]?.lines.map((line) => line.task)).toEqual(['Document Review', 'Drafting']);
        expect(next.projects[0]?.lines.map((line) => line.description)).toEqual(['IA review', 'BSSA review']);
    });
});
