import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { GroupEventAction } from 'src/group-events/enums/group-event-action.enum';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { User } from 'src/users/entities/user.entity';
import { Appointment } from './appointment.entity';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let repo: MockRepository;
  let notifications: {
    createForAppointmentGroup: jest.Mock;
    cancelForReferences: jest.Mock;
    deleteForReferences: jest.Mock;
  };
  let familyGroups: { findByDependentId: jest.Mock };
  let groupEvents: { log: jest.Mock; assertMembership: jest.Mock };

  const user = Object.assign(new User(), { id: 1 });
  const professionalUser = Object.assign(new ProfessionalUser(), { id: 2 });
  const dependent = Object.assign(new Dependent(), { id: 10, firstName: 'Tito', lastName: 'Pérez' });
  const group = {
    id: 100,
    createdBy: { id: 1 },
    members: [{ id: 1 }, { id: 3 }],
    dependent: { firstName: 'Tito', lastName: 'Pérez' },
  };

  beforeEach(async () => {
    repo = mockRepository();
    notifications = {
      createForAppointmentGroup: jest.fn(),
      cancelForReferences: jest.fn(),
      deleteForReferences: jest.fn(),
    };
    familyGroups = { findByDependentId: jest.fn() };
    groupEvents = { log: jest.fn(), assertMembership: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: repo },
        { provide: NotificationsService, useValue: notifications },
        { provide: FamilyGroupsService, useValue: familyGroups },
        { provide: GroupEventsService, useValue: groupEvents },
      ],
    }).compile();

    service = module.get(AppointmentsService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('assertAppointmentsLimit (plan gratuito)', () => {
    it('deja pasar con 9 turnos activos', async () => {
      repo.count.mockResolvedValue(9);
      await expect(service.assertAppointmentsLimit(user, false)).resolves.toBeUndefined();
    });

    it('rechaza el undécimo turno activo', async () => {
      repo.count.mockResolvedValue(10);
      await expect(service.assertAppointmentsLimit(user, false)).rejects.toThrow(
        'Alcanzaste el límite del plan gratuito: hasta 10 turnos activos.',
      );
    });

    it('un premium no tiene tope', async () => {
      repo.count.mockResolvedValue(40);
      await expect(service.assertAppointmentsLimit(user, true)).resolves.toBeUndefined();
    });

    it('cuenta sólo los activos del creador (creados o confirmados)', async () => {
      await service.assertAppointmentsLimit(dependent, false);
      const where = repo.count.mock.calls[0][0].where;
      expect(where).toMatchObject({ createdById: 10, createdByType: 'dependent' });
      expect(where.status.value).toEqual([EventStatus.CREATED, EventStatus.CONFIRMED]);
    });
  });

  describe('creación', () => {
    it('con profesional de la app: usuario se notifica a sí mismo, sin historial', async () => {
      repo.save.mockImplementation(async (a) => ({ ...a, id: 70 }));
      const pro = { id: 40, firstName: 'Julia', lastName: 'Ruiz' } as any;

      const saved = await service.createAppointmentWithProfessionalUser(
        { date: '2026-10-30T10:00:00Z', description: 'Control' } as any,
        user,
        pro,
      );

      expect(saved).toMatchObject({ id: 70, createdByType: 'user', professional: pro });
      expect(notifications.createForAppointmentGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          appointmentId: 70,
          groupId: null,
          memberUserIds: [1],
          payload: { professionalName: 'Julia Ruiz', description: 'Control', dependentName: null, dependentId: null },
        }),
      );
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('un profesional que saca turno para sí queda como "professional"', async () => {
      await service.createAppointmentWithProfessionalUser({} as any, professionalUser, null);
      expect(repo.create.mock.calls[0][0].createdByType).toBe('professional');
    });

    it('con "mi profesional" para un dependiente: avisa al grupo y lo registra', async () => {
      repo.save.mockImplementation(async (a) => ({ ...a, id: 71 }));
      familyGroups.findByDependentId.mockResolvedValue(group);

      await service.createAppointmentWithMyProfessional(
        { date: '2026-10-30T10:00:00Z' } as any,
        dependent,
        { firstName: 'Dr.', lastName: null } as any,
        3,
      );

      expect(notifications.createForAppointmentGroup.mock.calls[0][0]).toMatchObject({
        groupId: 100,
        memberUserIds: [1, 3],
        payload: { professionalName: 'Dr.', dependentName: 'Tito Pérez', dependentId: 10 },
      });
      expect(groupEvents.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: GroupEventAction.EVENT_CREATED, actorUserId: 3, targetId: 71 }),
      );
    });

    it('dependiente sin grupo o grupo vacío: no notifica; sin profesional dice "Profesional"', async () => {
      await service.createAppointmentWithMyProfessional({} as any, dependent, null);
      familyGroups.findByDependentId.mockResolvedValue({ id: 1, createdBy: null, members: null });
      await service.createAppointmentWithMyProfessional({} as any, dependent, null);
      expect(notifications.createForAppointmentGroup).not.toHaveBeenCalled();

      await service.createAppointmentWithMyProfessional({} as any, user, null);
      expect(notifications.createForAppointmentGroup.mock.calls[0][0].payload.professionalName).toBe('Profesional');
    });

    it('un error al notificar no rompe la creación', async () => {
      notifications.createForAppointmentGroup.mockRejectedValue(new Error('fcm'));
      await expect(service.createAppointmentWithMyProfessional({} as any, user, null)).resolves.toBeDefined();
    });
  });

  describe('listados', () => {
    it('ordenan próximos primero y filtran por creador', async () => {
      const past = { id: 1, date: new Date(Date.now() - 86400_000) };
      const next = { id: 2, date: new Date(Date.now() + 86400_000) };
      repo.find.mockResolvedValue([past, next]);

      const byUser = await service.getAppointmentsByUser(user);
      expect(byUser.map((a) => a.id)).toEqual([2, 1]);
      await service.getAppointmentsByDependent(dependent);
      await service.getNextAppointmentsByUser(professionalUser);
      await service.getNextAppointmentsByDependent(dependent);
      await service.getAppointmentsByCreator(dependent);

      const types = repo.find.mock.calls.map((c) => c[0].where.createdByType);
      expect(types).toEqual(['user', 'dependent', 'professional', 'dependent', 'dependent']);
    });

    it('getAppointmentById no arrastra datos sensibles de quien se hizo cargo', async () => {
      await service.getAppointmentById(5);
      expect(repo.findOne.mock.calls[0][0].select.takenChargeBy).toEqual({ id: true, firstName: true, lastName: true });
    });
  });

  describe('cancelAppointment', () => {
    it('cancela, apaga el recordatorio y registra quién fue', async () => {
      repo.findOne.mockResolvedValue({
        id: 70,
        createdByType: 'dependent',
        createdById: 10,
        professional: { firstName: 'Julia', lastName: 'Ruiz' },
      });
      familyGroups.findByDependentId.mockResolvedValue(group);

      await service.cancelAppointment(70, 3);

      expect(repo.update).toHaveBeenCalledWith(
        { id: 70 },
        expect.objectContaining({ status: EventStatus.CANCELED, canceledByUserId: 3 }),
      );
      expect(notifications.cancelForReferences).toHaveBeenCalledWith(NotificationType.APPOINTMENT, [70]);
      expect(groupEvents.log.mock.calls[0][0]).toMatchObject({
        action: GroupEventAction.EVENT_CANCELED,
        payload: { professionalName: 'Julia Ruiz', dependentName: 'Tito Pérez', automatic: false },
      });
    });

    it('si no existe sólo actualiza; un turno propio no va a ningún historial', async () => {
      await service.cancelAppointment(70);
      expect(notifications.cancelForReferences).not.toHaveBeenCalled();
      expect(repo.update.mock.calls[0][1].canceledByUserId).toBeNull();

      repo.findOne.mockResolvedValue({ id: 70, createdByType: 'user', createdById: 1 });
      await service.cancelAppointment(70, 1);
      expect(groupEvents.log).not.toHaveBeenCalled();
    });

    it('errores al apagar avisos o registrar no cortan la cancelación', async () => {
      repo.findOne.mockResolvedValue({ id: 70, createdByType: 'dependent', createdById: 10 });
      notifications.cancelForReferences.mockRejectedValue(new Error('x'));
      familyGroups.findByDependentId.mockRejectedValue(new Error('db'));
      await expect(service.cancelAppointment(70, 1)).resolves.toBeDefined();

      familyGroups.findByDependentId.mockResolvedValue(null);
      await service.cancelAppointment(70, 1);
      familyGroups.findByDependentId.mockResolvedValue({ ...group, dependent: null });
      await service.cancelAppointment(70, 1);
      expect(groupEvents.log.mock.calls[0][0].payload).toMatchObject({ professionalName: null, dependentName: null });
    });

    it('el cron cancela los turnos viejos sin confirmar como vencimiento automático', async () => {
      repo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      const spy = jest.spyOn(service, 'cancelAppointment');
      await expect(service.cancelOldCreatedAppointments()).resolves.toBe(2);
      expect(spy).toHaveBeenCalledWith(1, undefined, true);
      expect(spy).toHaveBeenCalledWith(2, undefined, true);
    });
  });

  describe('deleteAppointment', () => {
    it('404 si no existe', async () => {
      await expect(service.deleteAppointment(70, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('no se borra si alguien ya se hizo cargo', async () => {
      repo.findOne.mockResolvedValue({ id: 70, takenChargeByUserId: 3 });
      await expect(service.deleteAppointment(70, 1)).rejects.toBeInstanceOf(ConflictException);
    });

    it('un usuario no borra el turno de otro', async () => {
      repo.findOne.mockResolvedValue({ id: 70, createdByType: 'user', createdById: 1 });
      await expect(service.deleteAppointment(70, 2)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('turno de dependiente: sin grupo prohibido; con grupo exige pertenecer', async () => {
      repo.findOne.mockResolvedValue({ id: 70, createdByType: 'dependent', createdById: 10 });
      await expect(service.deleteAppointment(70, 1)).rejects.toBeInstanceOf(ForbiddenException);
      familyGroups.findByDependentId.mockResolvedValue(group);
      groupEvents.assertMembership.mockRejectedValue(new ForbiddenException());
      await expect(service.deleteAppointment(70, 99)).rejects.toBeInstanceOf(ForbiddenException);
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('borra, deja constancia y limpia los avisos', async () => {
      const appt = { id: 70, createdByType: 'dependent', createdById: 10, myProfessional: { firstName: 'Dra' } };
      repo.findOne.mockResolvedValue(appt);
      familyGroups.findByDependentId.mockResolvedValue(group);

      await expect(service.deleteAppointment(70, 3)).resolves.toEqual({ deleted: true });

      expect(groupEvents.log.mock.calls[0][0]).toMatchObject({
        action: GroupEventAction.EVENT_DELETED,
        payload: { professionalName: 'Dra' },
      });
      expect(notifications.deleteForReferences).toHaveBeenCalledWith(
        [NotificationType.APPOINTMENT, NotificationType.EVENT_TAKEN_CHARGE, NotificationType.EVENT_DECLINED],
        [70],
      );
      expect(repo.remove).toHaveBeenCalledWith(appt);
    });

    it('turno propio: se borra aunque falle la limpieza; errores del historial no cortan', async () => {
      repo.findOne.mockResolvedValue({ id: 70, createdByType: 'user', createdById: 1 });
      notifications.deleteForReferences.mockRejectedValue(new Error('x'));
      await expect(service.deleteAppointment(70, 1)).resolves.toEqual({ deleted: true });
      expect(groupEvents.log).not.toHaveBeenCalled();

      repo.findOne.mockResolvedValue({ id: 70, createdByType: 'dependent', createdById: 10 });
      familyGroups.findByDependentId
        .mockResolvedValueOnce(group)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(group)
        .mockRejectedValueOnce(new Error('db'));
      await service.deleteAppointment(70, 1);
      await service.deleteAppointment(70, 1);
      familyGroups.findByDependentId.mockResolvedValue({ ...group, dependent: null });
      await service.deleteAppointment(70, 1);
      expect(groupEvents.log).toHaveBeenCalledTimes(1);
      expect(groupEvents.log.mock.calls[0][0].payload).toMatchObject({ professionalName: null, dependentName: null });
    });
  });

  describe('confirmación y edición', () => {
    it('confirmAppointment', async () => {
      await service.confirmAppointment(70);
      expect(repo.update).toHaveBeenCalledWith({ id: 70 }, expect.objectContaining({ status: EventStatus.CONFIRMED }));
    });

    it('cambiar de profesional limpia el otro tipo', async () => {
      await service.updateAppointmentWithProfessionalUser(70, { date: 'd', description: 'x', professional: { id: 1 } });
      expect(repo.update.mock.calls[0][1]).toMatchObject({ professional: { id: 1 }, myProfessional: null });
      await service.updateAppointmentWithMyProfessional(70, { date: 'd', myProfessional: { id: 2 } });
      expect(repo.update.mock.calls[1][1]).toMatchObject({ myProfessional: { id: 2 }, professional: null });
    });
  });
});
