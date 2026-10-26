import { BadRequestException, ConflictException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from 'src/users/users.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { MedsEventController } from './meds-event.controller';
import { MedsEventService } from './meds-event.service';

describe('MedsEventController', () => {
  let controller: MedsEventController;
  let service: Record<string, jest.Mock>;
  let users: { getUserById: jest.Mock };
  let familyGroups: { getDependentById: jest.Mock };

  const me = { id: 1, premium: true };
  const dependent = { id: 10 };
  const req = { user: { id: '1' } };
  const dto: any = { medId: 3, date: '2026-10-30T08:00:00Z' };

  const httpError = async (promise: Promise<unknown>) => {
    const err = await promise.then(
      () => {
        throw new Error('Se esperaba un error');
      },
      (e) => e,
    );
    expect(err).toBeInstanceOf(HttpException);
    return [err.getStatus(), err.getResponse().message ?? err.getResponse()];
  };

  beforeEach(async () => {
    service = Object.fromEntries(
      [
        'getMedsEventsByUser',
        'getMedsEventsByDependent',
        'assertMedsLimit',
        'createMedEvent',
        'getMedTreatmentsByCreator',
        'cancelTreatment',
        'getMedEventById',
        'updateMedEvent',
        'cancelMedEvent',
        'deleteMedEvent',
        'confirmMedEvent',
        'skipMedEvent',
      ].map((m) => [m, jest.fn(async () => undefined)]),
    );
    users = { getUserById: jest.fn(async () => me) };
    familyGroups = { getDependentById: jest.fn(async () => dependent) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsEventController],
      providers: [
        { provide: MedsEventService, useValue: service },
        { provide: UsersService, useValue: users },
        { provide: FamilyGroupsService, useValue: familyGroups },
      ],
    }).compile();
    controller = module.get(MedsEventController);
  });

  describe('listados', () => {
    it('del usuario y tratamientos del usuario', async () => {
      service.getMedsEventsByUser.mockResolvedValue([{ id: 1 }]);
      await expect(controller.getMedsEventsByUserId(req)).resolves.toEqual([{ id: 1 }]);
      expect(service.getMedsEventsByUser).toHaveBeenCalledWith(me);
      await controller.getTreatments(req);
      expect(service.getMedTreatmentsByCreator).toHaveBeenCalledWith(me);
    });

    it.each([
      ['getMedsEventsByDependentId', 'getMedsEventsByDependent'],
      ['getTreatmentsByDependent', 'getMedTreatmentsByCreator'],
    ])('%s: 404 sin dependiente; si existe delega', async (method, serviceMethod) => {
      familyGroups.getDependentById.mockResolvedValueOnce(null);
      await expect(httpError((controller as any)[method](10))).resolves.toEqual([HttpStatus.NOT_FOUND, 'Dependiente no encontrado']);
      expect(service[serviceMethod]).not.toHaveBeenCalled();
      await (controller as any)[method](10);
      expect(service[serviceMethod]).toHaveBeenCalledWith(dependent);
    });

    it('GET /meds-event/:id: 404 si no existe', async () => {
      await expect(httpError(controller.getMedEventById(5))).resolves.toEqual([HttpStatus.NOT_FOUND, 'Recordatorio no encontrado']);
      service.getMedEventById.mockResolvedValue({ id: 5 });
      await expect(controller.getMedEventById(5)).resolves.toEqual({ id: 5 });
    });
  });

  describe('creación (límite del plan gratuito)', () => {
    it('para el usuario: chequea el límite con su premium y crea', async () => {
      service.createMedEvent.mockResolvedValue({ id: 50 });
      await expect(controller.createMedEvent(req, dto)).resolves.toEqual({ status: HttpStatus.CREATED, medEvent: { id: 50 } });
      expect(service.assertMedsLimit).toHaveBeenCalledWith(me, true);
      expect(service.createMedEvent).toHaveBeenCalledWith(me, dto);
    });

    it('límite alcanzado: se propaga y no se crea', async () => {
      service.assertMedsLimit.mockRejectedValue(new BadRequestException('Alcanzaste el límite del plan gratuito: hasta 10 medicamentos activos.'));
      await expect(controller.createMedEvent(req, dto)).rejects.toThrow('hasta 10 medicamentos activos');
      await expect(controller.createMedEventForDependent(10, req, dto)).rejects.toThrow('hasta 10 medicamentos activos');
      expect(service.createMedEvent).not.toHaveBeenCalled();
    });

    it('errores de validación del tratamiento se devuelven como 400 con su mensaje', async () => {
      service.createMedEvent.mockRejectedValueOnce(new Error('La duración es menor a la frecuencia elegida'));
      await expect(httpError(controller.createMedEvent(req, dto))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'La duración es menor a la frecuencia elegida',
      ]);
      service.createMedEvent.mockRejectedValueOnce({});
      await expect(httpError(controller.createMedEvent(req, dto))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'No se pudo crear el recordatorio',
      ]);
    });

    it('para un dependiente: el límite cuenta los del dependiente con el premium de quien carga', async () => {
      service.createMedEvent.mockResolvedValue({ id: 51 });
      await expect(controller.createMedEventForDependent(10, req, dto)).resolves.toEqual({
        status: HttpStatus.CREATED,
        medEvent: { id: 51 },
      });
      expect(service.assertMedsLimit).toHaveBeenCalledWith(dependent, true);
      expect(service.createMedEvent).toHaveBeenCalledWith(dependent, dto, 1);
    });

    it('para un dependiente inexistente: 404; otros errores 400', async () => {
      familyGroups.getDependentById.mockResolvedValueOnce(null);
      await expect(httpError(controller.createMedEventForDependent(99, req, dto))).resolves.toEqual([
        HttpStatus.NOT_FOUND,
        'Dependiente no encontrado',
      ]);
      service.createMedEvent.mockRejectedValueOnce({});
      await expect(httpError(controller.createMedEventForDependent(10, req, dto))).resolves.toEqual([
        HttpStatus.BAD_REQUEST,
        'No se pudo crear el recordatorio para dependiente',
      ]);
    });
  });

  describe('tratamientos', () => {
    it('cancelar uno propio o de un dependiente pasa quién cancela', async () => {
      service.cancelTreatment.mockResolvedValue({ canceled: 4 });
      await expect(controller.cancelTreatment('serie', req)).resolves.toEqual({ status: HttpStatus.OK, canceled: 4 });
      expect(service.cancelTreatment).toHaveBeenCalledWith('serie', me, 1);
      await expect(controller.cancelTreatmentForDependent('serie', 10, req)).resolves.toEqual({ status: HttpStatus.OK, canceled: 4 });
      expect(service.cancelTreatment).toHaveBeenLastCalledWith('serie', dependent, 1);
    });

    it('dependiente inexistente: 404', async () => {
      familyGroups.getDependentById.mockResolvedValue(null);
      await expect(httpError(controller.cancelTreatmentForDependent('serie', 99, req))).resolves.toEqual([
        HttpStatus.NOT_FOUND,
        'Dependiente no encontrado',
      ]);
    });
  });

  describe('registro de tomas y edición', () => {
    it.each([
      ['confirmMedEvent', 'confirmMedEvent'],
      ['skipMedEvent', 'skipMedEvent'],
      ['cancelMedEvent', 'cancelMedEvent'],
    ])('%s pasa el usuario del token', async (method, serviceMethod) => {
      await expect((controller as any)[method](5, req)).resolves.toEqual({ status: HttpStatus.OK });
      expect(service[serviceMethod]).toHaveBeenCalledWith(5, 1);
    });

    it('confirmar o marcar sin permiso propaga el 403 y el 409', async () => {
      service.confirmMedEvent.mockRejectedValue(new ForbiddenException('No pertenecés al grupo de este dependiente'));
      await expect(controller.confirmMedEvent(5, req)).rejects.toBeInstanceOf(ForbiddenException);
      service.skipMedEvent.mockRejectedValue(new ConflictException('El recordatorio está cancelado'));
      await expect(controller.skipMedEvent(5, req)).rejects.toBeInstanceOf(ConflictException);
    });

    it('borrar devuelve lo que informa el servicio', async () => {
      service.deleteMedEvent.mockResolvedValue({ deleted: 3 });
      await expect(controller.deleteMedEvent(5, req)).resolves.toEqual({ deleted: 3 });
      expect(service.deleteMedEvent).toHaveBeenCalledWith(5, 1);
    });

    it('editar delega los cambios', async () => {
      await expect(controller.updateMedEvent(5, { medId: 4 })).resolves.toEqual({ status: HttpStatus.OK });
      expect(service.updateMedEvent).toHaveBeenCalledWith(5, { medId: 4 });
    });
  });
});
