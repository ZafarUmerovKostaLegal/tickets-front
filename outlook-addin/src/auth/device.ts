const DEVICE_KEY = 'kosta.outlook.deviceId';
const SECRET_KEY = 'kosta.outlook.deviceSecret';

function roamingGet(key: string): string | null {
  try {
    const value = Office?.context?.roamingSettings?.get(key);
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

function roamingSet(key: string, value: string): void {
  try {
    const roaming = Office?.context?.roamingSettings;
    if (!roaming)
      return;
    roaming.set(key, value);
    roaming.saveAsync(() => undefined);
  } catch {
    /* ignore */
  }
}

function uuid(): string {
  if (crypto.randomUUID)
    return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY) || roamingGet(DEVICE_KEY);
  if (!id || id.length < 8) {
    id = uuid();
    localStorage.setItem(DEVICE_KEY, id);
    roamingSet(DEVICE_KEY, id);
  }
  return id;
}

export function getOrCreateDeviceSecret(): string {
  let secret = localStorage.getItem(SECRET_KEY) || roamingGet(SECRET_KEY);
  if (!secret || secret.length < 16) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    let binary = '';
    bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    secret = btoa(binary);
    localStorage.setItem(SECRET_KEY, secret);
    roamingSet(SECRET_KEY, secret);
  }
  return secret;
}
