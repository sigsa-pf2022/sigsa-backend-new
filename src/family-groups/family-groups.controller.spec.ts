import { BadRequestException, ForbiddenException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from 'src/users/users.service';
import { FamilyGroupsController } from './family-groups.controller';
import { FamilyGroupsService } from './family-groups.service';

describe('FamilyGroupsController', () => {
  let controller: FamilyGroupsController;
  let service: Record<string, jest.Mock>;
  let users: { getUserById: jest.Mock; getFullUserByDni: jest.Mock };
  const me = { id: 1, dni: '30' };
  const req = { user: { id: 1 } } as any;

  const httpError = async (promise: Promise<unknown>) => {
    const err = await promise.then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    return [err.getStatus(), err.getResponse().message];
  };

  beforeEach(async () => {
    service = Object.fromEntries(
      [
        'createGroup',
        'getFamilyGroupsByUser',
        'getDependentByDni',
        'getPendingRequestsForUser',
        'acceptProfessionalRequest',
        'rejectProfessionalRequest',
        'getFamilyGroupById',
        'removeMemberFromGroup',
        'updateGroupPhoto',
        'addMemberToGroup',
      ].map((m) => [m, jest.fn(async () => true)]),
    );
    users = { getUserById: jest.fn(async () => me), getFullUserByDni: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FamilyGroupsController],
      providers: [
        { provide: FamilyGroupsService, useValue: service },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    controller = module.get(FamilyGroupsController);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('POST /family-groups/create', () => {
    const body = (members?: any) => ({ name: 'Familia', firstName: 'Tito', lastName: 'Pérez', dni: '50', members });

    it('el creador queda como integrante y los invitados se buscan por DNI sin repetir', async () => {
      const beto = { id: 2, dni: '31' };
      users.getFullUserByDni.mockResolvedValue(beto);
      service.createGroup.mockResolvedValue({ id: 100 });

      await expect(controller.createFamilyGroup(body([{ dni: '31' }, { dni: '31' }]), req)).resolves.toEqual({
        status: HttpStatus.CREATED,
        id: 100,
      });
      expect(service.createGroup).toHaveBeenCalledWith(
        'Familia',
        { firstName: 'Tito', lastName: 'Pérez', dni: '50' },
        me,
        [me, beto],
      );
    });

    it('si el creador se incluye a sí mismo entre los invitados no se duplica', async () => {
      users.getFullUserByDni.mockResolvedValue(me);
      service.createGroup.mockResolvedValue({ id: 100 });
      await controller.createFamilyGroup(body([{ dni: '30' }]), req);
      expect(service.createGroup.mock.calls[0][3]).toEqual([me]);
    });

    it('sin lista de invitados crea el grupo sólo con el creador', async () => {
      service.createGroup.mockResolvedValue({ id: 100 });
      await controller.createFamilyGroup(body(undefined), req);
      expect(service.createGroup.mock.calls[0][3]).toEqual([me]);
    });

    it('un DNI que no existe corta el alta con un mensaje claro', async () => {
      users.getFullUserByDni.mockResolvedValue(null);
      await expect(controller.createFamilyGroup(body([{ dni: '99' }]), req)).rejects.toThrow(
        'No encontramos un usuario con el DNI 99',
      );
      expect(service.createGroup).not.toHaveBeenCalled();
    });

    it('el límite del plan se propaga; otros errores son 400 genérico', async () => {
      service.createGroup.mockRejectedValueOnce(new BadRequestException('Alcanzaste el límite del plan gratuito: hasta 5 grupos.'));
      await expect(controller.createFamilyGroup(body(), req)).rejects.toThrow('hasta 5 grupos');

      service.createGroup.mockRejectedValueOnce(new Error('db'));
      await expect(httpError(controller.createFamilyGroup(body(), req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'No se pudo crear el grupo. Revisá los datos del dependiente.',
      ]);
    });
  });

  it('GET /my-groups delega con el usuario del token', async () => {
    service.getFamilyGroupsByUser.mockResolvedValue([{ id: 100 }]);
    await expect(controller.getFamilyGroupsByUserId(req)).resolves.toEqual([{ id: 100 }]);
    expect(service.getFamilyGroupsByUser).toHaveBeenCalledWith(me);
  });

  it('GET /dependents/search exige el DNI', async () => {
    await expect(httpError(controller.searchDependentByDni(''))).resolves.toEqual([
      HttpStatus.BAD_REQUEST,
      'El parámetro dni es requerido',
    ]);
    service.getDependentByDni.mockResolvedValue([{ dependentId: 10 }]);
    await expect(controller.searchDependentByDni('50')).resolves.toEqual([{ dependentId: 10 }]);
  });

  it('GET /professional-requests', async () => {
    await controller.getProfessionalRequests(req);
    expect(service.getPendingRequestsForUser).toHaveBeenCalledWith(1);
  });

  describe.each([
    ['acceptProfessionalRequest', 'No se pudo aceptar la solicitud'],
    ['rejectProfessionalRequest', 'No se pudo rechazar la solicitud'],
  ])('%s', (method, genericMessage) => {
    it('delega con el id numérico y el usuario del token', async () => {
      service[method].mockResolvedValue({ id: 500, status: 'ACCEPTED' });
      await expect((controller as any)[method]('500', req)).resolves.toEqual({ id: 500, status: 'ACCEPTED' });
      expect(service[method]).toHaveBeenCalledWith(500, 1);
    });

    it('traduce 403, 404 y errores inesperados', async () => {
      service[method].mockRejectedValueOnce(new ForbiddenException('No tenés permiso para resolver esta solicitud'));
      await expect(httpError((controller as any)[method]('500', req))).resolves.toEqual([
        HttpStatus.FORBIDDEN,
        'No tenés permiso para resolver esta solicitud',
      ]);
      service[method].mockRejectedValueOnce(new NotFoundException('Solicitud no encontrada o ya resuelta'));
      await expect(httpError((controller as any)[method]('500', req))).resolves.toEqual([
        HttpStatus.NOT_FOUND,
        'Solicitud no encontrada o ya resuelta',
      ]);
      service[method].mockRejectedValueOnce(new Error('db'));
      await expect(httpError((controller as any)[method]('500', req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        genericMessage,
      ]);
    });
  });

  it('GET /:id devuelve el grupo o 400 si no existe', async () => {
    service.getFamilyGroupById.mockResolvedValueOnce({ id: 100 });
    await expect(controller.getFamilyGroupById({ params: { id: '100' } })).resolves.toEqual({ id: 100 });
    expect(service.getFamilyGroupById).toHaveBeenCalledWith('100');
    service.getFamilyGroupById.mockResolvedValueOnce(null);
    await expect(httpError(controller.getFamilyGroupById({ params: { id: '9' } }))).resolves.toEqual([
      HttpStatus.BAD_REQUEST,
      'No se encontro un grupo con el ID solicitado',
    ]);
  });

  describe('DELETE /:groupId/members/:memberId', () => {
    it('delega con ids numéricos y el usuario del token', async () => {
      await expect(controller.removeMemberFromFamilyGroup('100', '2', req)).resolves.toEqual({
        status: HttpStatus.OK,
        message: 'Miembro eliminado correctamente',
      });
      expect(service.removeMemberFromGroup).toHaveBeenCalledWith(100, 2, me);
    });

    it('un integrante que no es responsable recibe 403', async () => {
      service.removeMemberFromGroup.mockRejectedValue(
        new ForbiddenException('Sólo el responsable del grupo puede quitar integrantes'),
      );
      await expect(httpError(controller.removeMemberFromFamilyGroup('100', '2', req))).resolves.toEqual([
        HttpStatus.FORBIDDEN,
        'Sólo el responsable del grupo puede quitar integrantes',
      ]);
    });

    it('si el servicio no pudo quitarlo, 400', async () => {
      service.removeMemberFromGroup.mockResolvedValue(false);
      await expect(httpError(controller.removeMemberFromFamilyGroup('100', '2', req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'Error al eliminar el miembro del grupo',
      ]);
    });
  });

  it('PATCH /:groupId/photo delega y propaga el 403', async () => {
    service.updateGroupPhoto.mockResolvedValueOnce({ id: 100, photo: 'p' });
    await expect(controller.updateGroupPhoto('100', { photo: 'p' } as any, req)).resolves.toEqual({ id: 100, photo: 'p' });
    expect(service.updateGroupPhoto).toHaveBeenCalledWith(100, 'p', me);
    service.updateGroupPhoto.mockRejectedValueOnce(new ForbiddenException());
    await expect(controller.updateGroupPhoto('100', { photo: 'p' } as any, req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  describe('POST /:groupId/members', () => {
    it('agrega al integrante', async () => {
      await expect(controller.addMemberToFamilyGroup('100', { dni: '31' }, req)).resolves.toEqual({
        status: HttpStatus.OK,
        message: 'Miembro agregado correctamente',
      });
      expect(service.addMemberToGroup).toHaveBeenCalledWith(100, { dni: '31' }, me);
    });

    it('si no se pudo o falla, 400', async () => {
      service.addMemberToGroup.mockResolvedValueOnce(false);
      await expect(httpError(controller.addMemberToFamilyGroup('100', {}, req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'Error al agregar el miembro al grupo',
      ]);
      service.addMemberToGroup.mockRejectedValueOnce(new Error('db'));
      await expect(httpError(controller.addMemberToFamilyGroup('100', {}, req))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'Error al agregar el miembro al grupo',
      ]);
    });
  });
});
