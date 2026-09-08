import { CanActivate, ExecutionContext, mixin, Type } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Role } from '../enums/role.enum';

/**
 * Deja pasar sólo a los roles que recibe.
 *
 * La versión anterior declaraba adentro `const roles = [request.user.role]`,
 * que pisaba al parámetro: terminaba preguntando si el rol del usuario está en
 * la lista formada por su propio rol, o sea siempre que sí. Con eso cualquier
 * usuario autenticado entraba a los endpoints de profesional (por ejemplo, la
 * búsqueda de dependientes por DNI).
 */
const RoleGuard = (roles: Role[]): Type<CanActivate> => {
  class RoleGuardMixin extends JwtAuthGuard {
    async canActivate(context: ExecutionContext) {
      await super.canActivate(context);
      const request = context.switchToHttp().getRequest();
      return roles.includes(request.user?.role);
    }
  }

  return mixin(RoleGuardMixin);
};

export default RoleGuard;
