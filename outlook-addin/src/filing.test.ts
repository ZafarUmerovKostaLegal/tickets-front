import { describe, expect, it } from 'vitest';
import { describeOutcome, isFresh } from './filing';

describe('upload outcomes', () => {
  const doc = { id: 'd1', name: 'old name.eml', version: 3 };

  it('explains what the server did instead of making copies', () => {
    expect(describeOutcome('a.eml', { status: 'created', document: doc })).toBe('a.eml');
    expect(describeOutcome('a.docx', { status: 'version', document: doc })).toBe('a.docx — новая версия v3');
    expect(describeOutcome('a.docx', { status: 'unchanged', document: doc })).toBe('a.docx — без изменений');
    expect(describeOutcome('a.eml', { status: 'exists', document: doc })).toBe('a.eml — уже сохранено в этом matter (old name.eml)');
    expect(describeOutcome('b.pdf', { status: 'duplicate', document: doc })).toBe('b.pdf — такой файл уже есть: old name.eml');
  });

  it('counts only new documents and versions as fresh', () => {
    expect(isFresh({ status: 'created', document: doc })).toBe(true);
    expect(isFresh({ status: 'version', document: doc })).toBe(true);
    expect(isFresh({ status: 'exists', document: doc })).toBe(false);
    expect(isFresh({ status: 'unchanged', document: doc })).toBe(false);
  });
});
