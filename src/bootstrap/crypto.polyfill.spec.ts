import { webcrypto } from 'crypto';

describe('crypto.polyfill', () => {
  const g = global as typeof global & { crypto?: unknown };
  let original: PropertyDescriptor | undefined;

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(g, 'crypto');
  });

  afterEach(() => {
    if (original) Object.defineProperty(g, 'crypto', original);
    else delete g.crypto;
  });

  it('expone webcrypto como global cuando falta (Node 18)', () => {
    Object.defineProperty(g, 'crypto', { value: undefined, configurable: true, writable: true });
    jest.isolateModules(() => require('./crypto.polyfill'));
    expect(g.crypto).toBe(webcrypto);
  });

  it('no pisa un crypto global existente', () => {
    const existing = { propio: true };
    Object.defineProperty(g, 'crypto', { value: existing, configurable: true, writable: true });
    jest.isolateModules(() => require('./crypto.polyfill'));
    expect(g.crypto).toBe(existing);
  });
});
