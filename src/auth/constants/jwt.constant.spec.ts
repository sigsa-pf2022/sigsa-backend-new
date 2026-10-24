import { DEFAULT_EXPIRES_IN, resolveJwtSecret } from './jwt.constant';

describe('resolveJwtSecret', () => {
  it('sin secreto el backend no arranca', () => {
    expect(() => resolveJwtSecret(undefined)).toThrow('Falta JWT_SECRET');
    expect(() => resolveJwtSecret(null)).toThrow('Falta JWT_SECRET');
  });

  it('rechaza un secreto de menos de 32 caracteres (sin contar espacios)', () => {
    expect(() => resolveJwtSecret('corto')).toThrow('menos de 32 caracteres');
    expect(() => resolveJwtSecret(`  ${'a'.repeat(31)}  `)).toThrow();
  });

  it('devuelve el secreto recortado', () => {
    const secret = 'x'.repeat(48);
    expect(resolveJwtSecret(` ${secret}\n`)).toBe(secret);
  });

  it('los tokens vencen a las 10 horas', () => {
    expect(DEFAULT_EXPIRES_IN).toBe('10h');
  });
});
