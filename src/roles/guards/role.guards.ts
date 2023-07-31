import { CanActivate, ExecutionContext, mixin, Type } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Role } from '../enums/role.enum';

const RoleGuard = (roles: Role[]): Type<CanActivate> => {
  class RoleGuardMixin extends JwtAuthGuard {
    async canActivate(context: ExecutionContext) {
      await super.canActivate(context);
      const request = context.switchToHttp().getRequest();
      const roles = [request.user.role];
      for (const rol of roles) {
        if (roles.includes(rol)) {
          return true;
        }
      }
      return false;
    }
  }

  return mixin(RoleGuardMixin);
};

export default RoleGuard;
