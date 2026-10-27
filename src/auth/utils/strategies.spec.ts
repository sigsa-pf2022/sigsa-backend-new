import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
import { JwtStrategy } from './jwt.strategy';
import { LocalStrategy } from './local.strategy';

describe('JwtStrategy', () => {
  const config = (secret?: string) => ({ get: jest.fn(() => secret) } as unknown as ConfigService);

  it('no se construye sin un JWT_SECRET válido', () => {
    expect(() => new JwtStrategy(config(undefined))).toThrow('Falta JWT_SECRET');
  });

  it('del payload sólo deja pasar id, email y rol', async () => {
    const strategy = new JwtStrategy(config('s'.repeat(40)));
    await expect(
      strategy.validate({ id: 1, email: 'ana@mail.com', role: 'user', iat: 1, exp: 2 }),
    ).resolves.toEqual({ id: 1, email: 'ana@mail.com', role: 'user' });
  });
});

describe('LocalStrategy', () => {
  it('delega la validación de credenciales en AuthService', async () => {
    const auth = { validateUser: jest.fn(async () => ({ id: 1 })) } as unknown as AuthService;
    const strategy = new LocalStrategy(auth);
    await expect(strategy.validate('ana@mail.com', 'clave')).resolves.toEqual({ id: 1 });
    expect(auth.validateUser).toHaveBeenCalledWith('ana@mail.com', 'clave');
  });
});
