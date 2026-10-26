import { Role } from '../enums/role.enum';
import { Roles, ROLES_KEY } from './roles.decorator';

describe('Roles', () => {
  it('guarda los roles en la metadata del handler', () => {
    class Controller {
      @Roles(Role.Admin, Role.Professional)
      handler() {
        return null;
      }
    }
    expect(Reflect.getMetadata(ROLES_KEY, Controller.prototype.handler)).toEqual([Role.Admin, Role.Professional]);
  });
});
