/**
 * Manual/Node smoke check: npx tsx src/auth/crypto.test.ts
 * (not wired into CI — Outlook add-in has no vitest yet)
 */
import { decryptSecret, encryptSecret, newDeviceSecret } from './crypto';

async function main() {
  const secret = newDeviceSecret();
  const deviceId = 'device-test-123456';
  const token = 'refresh-token-plain-value';
  const enc = await encryptSecret(token, secret, deviceId);
  const dec = await decryptSecret(enc, secret, deviceId);
  if (dec !== token)
    throw new Error(`roundtrip failed: ${dec}`);
  console.log('crypto roundtrip ok');
}

void main();
