import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Role } from '../enums/role.enum';
import RoleGuard from './role.guards';

describe('RoleGuard', () => {
  const contextFor = (user?: { role: Role }) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext);

  let jwtCanActivate: jest.SpyInstance;

  beforeEach(() => {
    // El guard hereda de JwtAuthGuard: se simula que el token ya es válido.
    jwtCanActivate = jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('deja pasar a un rol permitido', async () => {
    const guard = new (RoleGuard([Role.Professional]))();
    await expect(guard.canActivate(contextFor({ role: Role.Professional }))).resolves.toBe(true);
    expect(jwtCanActivate).toHaveBeenCalled();
  });

  it('rechaza a un rol no permitido (regresión: antes dejaba pasar a cualquiera)', async () => {
    const guard = new (RoleGuard([Role.Professional]))();
    await expect(guard.canActivate(contextFor({ role: Role.User }))).resolves.toBe(false);
  });

  it('acepta varios roles', async () => {
    const guard = new (RoleGuard([Role.Admin, Role.Professional]))();
    await expect(guard.canActivate(contextFor({ role: Role.Admin }))).resolves.toBe(true);
    await expect(guard.canActivate(contextFor({ role: Role.User }))).resolves.toBe(false);
  });

  it('sin usuario en el request, rechaza', async () => {
    const guard = new (RoleGuard([Role.Admin]))();
    await expect(guard.canActivate(contextFor(undefined))).resolves.toBe(false);
  });

  it('si el token es inválido, el error de JWT se propaga', async () => {
    jwtCanActivate.mockRejectedValue(new UnauthorizedException());
    const guard = new (RoleGuard([Role.Admin]))();
    await expect(guard.canActivate(contextFor({ role: Role.Admin }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
