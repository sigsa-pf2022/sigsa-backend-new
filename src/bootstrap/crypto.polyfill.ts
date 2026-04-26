import { webcrypto } from 'crypto';

if (!(global as typeof global & { crypto?: Crypto }).crypto) {
  (global as typeof global & { crypto: Crypto }).crypto = webcrypto as Crypto;
}