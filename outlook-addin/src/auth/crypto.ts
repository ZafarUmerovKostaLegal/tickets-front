const ENC_PREFIX = 'v1:';

function b64encode(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function b64decode(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1)
    out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveKey(deviceSecret: string, deviceId: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${deviceSecret}|${deviceId}|kosta-outlook-fm`),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode('kosta.outlook.refresh.v1'),
      iterations: 120_000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptSecret(plaintext: string, deviceSecret: string, deviceId: string): Promise<string> {
  const key = await deriveKey(deviceSecret, deviceId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  return `${ENC_PREFIX}${b64encode(iv)}.${b64encode(new Uint8Array(cipher))}`;
}

export async function decryptSecret(payload: string, deviceSecret: string, deviceId: string): Promise<string | null> {
  if (!payload.startsWith(ENC_PREFIX))
    return null;
  try {
    const [ivPart, dataPart] = payload.slice(ENC_PREFIX.length).split('.');
    if (!ivPart || !dataPart)
      return null;
    const key = await deriveKey(deviceSecret, deviceId);
    const iv = b64decode(ivPart);
    const data = b64decode(dataPart);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer },
      key,
      data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer,
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export function newDeviceSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64encode(bytes);
}
