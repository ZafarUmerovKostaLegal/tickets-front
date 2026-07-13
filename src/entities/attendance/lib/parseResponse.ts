import type { AttendanceByCamera } from '../model/types';
import { ERR_NOT_JSON, ERR_PARSE_FAILED, SNIPPET_LEN } from './constants';
function getSnippet(text: string): string {
    return text ? ` ${text.slice(0, SNIPPET_LEN)}…` : '';
}
export async function parseAttendanceJson(res: Response): Promise<AttendanceByCamera[]> {
    const text = await res.text().catch(() => '');
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
        throw new Error(`${ERR_NOT_JSON}${getSnippet(text)}`);
    }
    try {
        return JSON.parse(text) as AttendanceByCamera[];
    }
    catch {
        throw new Error(`${ERR_PARSE_FAILED}${getSnippet(text)}`);
    }
}
