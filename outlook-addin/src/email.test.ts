import { describe, expect, it } from 'vitest';
import { bareEmailAddress, buildEmlText, emlFileName, normalizeMessageId, type MailSnapshot } from './email';

const mail: MailSnapshot = {
  messageId: 'abc123@mail.acme.com',
  subject: 'Договор №5',
  fromEmail: 'boss@acme.com',
  fromName: 'Борис',
  to: 'lawyer@kostalegal.com',
  cc: '',
  received: '2026-11-17T10:00:00.000Z',
  bodyHtml: '<p>Привет</p>',
  bodyText: 'Привет\nвторая строка',
};

function splitHeaders(eml: string) {
  const end = eml.indexOf('\r\n\r\n');
  return { headers: eml.slice(0, end).split('\r\n'), body: eml.slice(end + 4) };
}

describe('buildEmlText', () => {
  it('keeps all headers in one block when there is no Cc', () => {
    const { headers } = splitHeaders(buildEmlText(mail, 'B'));
    expect(headers.map((h) => h.split(':')[0])).toEqual([
      'From', 'To', 'Subject', 'Date', 'Message-ID', 'MIME-Version', 'Content-Type',
    ]);
  });

  it('adds Cc when present', () => {
    const { headers } = splitHeaders(buildEmlText({ ...mail, cc: 'x@y.z' }, 'B'));
    expect(headers).toContain('Cc: x@y.z');
  });

  it('encodes non-ASCII headers and wraps the Message-ID in angle brackets', () => {
    const { headers } = splitHeaders(buildEmlText(mail, 'B'));
    expect(headers).toContain('Message-ID: <abc123@mail.acme.com>');
    expect(headers.find((h) => h.startsWith('Subject:'))).toMatch(/^Subject: =\?UTF-8\?B\?.+\?=$/);
    expect(headers.find((h) => h.startsWith('From:'))).toMatch(/<boss@acme\.com>$/);
  });

  it('uses CRLF everywhere and closes the multipart body', () => {
    const eml = buildEmlText(mail, 'B');
    expect(eml.replace(/\r\n/g, '')).not.toContain('\n');
    const { body } = splitHeaders(eml);
    expect(body).toContain('--B\r\nContent-Type: text/plain');
    expect(body).toContain('Привет\r\nвторая строка');
    expect(body.trimEnd().endsWith('--B--')).toBe(true);
  });

  it('falls back to undisclosed recipients and a synthetic Message-ID', () => {
    const { headers } = splitHeaders(buildEmlText({ ...mail, to: '', messageId: 'aaqkadg' }, 'B'));
    expect(headers).toContain('To: undisclosed-recipients:;');
    expect(headers).toContain('Message-ID: <aaqkadg@kosta.local>');
  });
});

describe('email helpers', () => {
  it('normalises message ids and sender addresses', () => {
    expect(normalizeMessageId(' <ABC@X> ')).toBe('abc@x');
    expect(bareEmailAddress('Борис <boss@acme.com>')).toBe('boss@acme.com');
    expect(bareEmailAddress(' boss@acme.com ')).toBe('boss@acme.com');
  });

  it('builds a safe file name', () => {
    expect(emlFileName('Re: a/b?*', '2026-11-17T10:00:00Z')).toBe('2026-11-17_Re_ a_b__.eml');
    expect(emlFileName('', '2026-11-17')).toBe('2026-11-17_email.eml');
  });
});
