import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Appointment } from 'src/appointments/appointment.entity';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';
import { MedEvent } from 'src/meds/meds-event/med-event.entity';
import { NotificationRecipient } from 'src/notifications/entities/notification-recipient.entity';
import { Notification } from 'src/notifications/entities/notification.entity';
import { NotificationRecipientAction } from 'src/notifications/enums/notification-recipient-action.enum';
import { NotificationRecipientStatus } from 'src/notifications/enums/notification-recipient-status.enum';
import { NotificationType } from 'src/notifications/enums/notification-type.enum';
import { NotificationsService } from 'src/notifications/notifications.service';
import { User } from 'src/users/entities/user.entity';
import { GroupEventLog } from './entities/group-event-log.entity';
import { GroupEventAction, GroupEventTargetType } from './enums/group-event-action.enum';
import { GroupEventsService } from './group-events.service';

describe('GroupEventsService', () => {
  let service: GroupEventsService;
  let logRepo: MockRepository;
  let notificationRepo: MockRepository;
  let recipientRepo: MockRepository;
  let medEventRepo: MockRepository;
  let appointmentRepo: MockRepository;
  let familyGroupRepo: MockRepository;
  let userRepo: MockRepository;
  let notifications: {
    createForEventTakenCharge: jest.Mock;
    createForEventDeclined: jest.Mock;
    deleteForReferences: jest.Mock;
  };

  const future = () => new Date(Date.now() + 3600_000);

  /** Aviso grupal de un turno con tres integrantes. */
  const notification = (overrides: any = {}) => ({
    id: 1,
    type: NotificationType.APPOINTMENT,
    referenceId: 70,
    groupId: 100,
    payload: { dependentName: 'Tito Pérez' },
    recipients: [
      { id: 11, userId: 1, status: NotificationRecipientStatus.PENDING },
      { id: 12, userId: 2, status: NotificationRecipientStatus.PENDING },
      { id: 13, userId: 3, status: NotificationRecipientStatus.DELIVERED },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    logRepo = mockRepository();
    notificationRepo = mockRepository();
    recipientRepo = mockRepository();
    medEventRepo = mockRepository();
    appointmentRepo = mockRepository();
    familyGroupRepo = mockRepository();
    userRepo = mockRepository();
    notifications = {
      createForEventTakenCharge: jest.fn(),
      createForEventDeclined: jest.fn(),
      deleteForReferences: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupEventsService,
        { provide: getRepositoryToken(GroupEventLog), useValue: logRepo },
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: getRepositoryToken(NotificationRecipient), useValue: recipientRepo },
        { provide: getRepositoryToken(MedEvent), useValue: medEventRepo },
        { provide: getRepositoryToken(Appointment), useValue: appointmentRepo },
        { provide: getRepositoryToken(FamilyGroup), useValue: familyGroupRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();

    service = module.get(GroupEventsService);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('log', () => {
    it('guarda la entrada completando los opcionales con null', async () => {
      await service.log({
        groupId: 100,
        action: GroupEventAction.MEMBER_ADDED,
        targetType: GroupEventTargetType.MEMBER,
      });
      expect(logRepo.save).toHaveBeenCalledWith({
        groupId: 100,
        actorUserId: null,
        action: GroupEventAction.MEMBER_ADDED,
        targetType: GroupEventTargetType.MEMBER,
        targetId: null,
        payload: null,
      });
    });

    it('sin grupo no registra nada', async () => {
      await expect(service.log({ groupId: 0 } as any)).resolves.toBeNull();
      expect(logRepo.save).not.toHaveBeenCalled();
    });

    it('nunca tira, aunque falle la base', async () => {
      logRepo.save.mockRejectedValue(new Error('db'));
      await expect(
        service.log({ groupId: 1, action: GroupEventAction.EVENT_CREATED, targetType: GroupEventTargetType.APPOINTMENT }),
      ).resolves.toBeNull();
    });
  });

  describe('"Me hago cargo"', () => {
    beforeEach(() => {
      appointmentRepo.findOne.mockResolvedValue({ id: 70, date: future(), status: EventStatus.CREATED });
      userRepo.findOne.mockResolvedValue({ id: 1, firstName: 'Ana', lastName: 'Pérez' });
    });

    it('404 si la notificación no existe', async () => {
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sólo responde quien recibió el aviso', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      await expect(
        service.respondToNotification(1, 99, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('La notificación no es tuya');
    });

    it('un aviso que no es de turno ni de medicamento no admite acciones', async () => {
      notificationRepo.findOne.mockResolvedValue(notification({ type: NotificationType.EVENT_TAKEN_CHARGE }));
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('Esta notificación no admite acciones');
    });

    it('404 si el evento ya no existe', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      appointmentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('El evento ya no existe');
    });

    it('no se responde sobre un evento cancelado', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      appointmentRepo.findOne.mockResolvedValue({ id: 70, date: future(), status: EventStatus.CANCELED });
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('El evento fue cancelado');
    });

    it('no se responde sobre un evento que ya pasó', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      appointmentRepo.findOne.mockResolvedValue({ id: 70, date: new Date(Date.now() - 1000), status: EventStatus.CREATED });
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('El evento ya pasó');
    });

    it('si otro ya se hizo cargo, gana el primero', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      appointmentRepo.findOne.mockResolvedValue({ id: 70, date: future(), takenChargeByUserId: 2 });
      userRepo.findOne
        .mockResolvedValueOnce({ id: 1, firstName: 'Ana', lastName: 'Pérez' })
        .mockResolvedValueOnce({ id: 2, firstName: 'Beto', lastName: 'Pérez' });
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('Beto Pérez ya se hizo cargo');
    });

    it('si el que se hizo cargo ya no existe, el mensaje es genérico', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      appointmentRepo.findOne.mockResolvedValue({ id: 70, date: future(), takenChargeByUserId: 2 });
      userRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('Otro integrante ya se hizo cargo');
    });

    it('sella el evento como confirmado, cancela los avisos pendientes, avisa al resto y lo registra', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());

      const result = await service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE);

      expect(result).toMatchObject({
        status: 'taken_charge',
        takenChargeByUserId: 1,
        takenChargeByName: 'Ana Pérez',
      });
      expect(appointmentRepo.update).toHaveBeenCalledWith(
        70,
        expect.objectContaining({ takenChargeByUserId: 1, status: EventStatus.CONFIRMED }),
      );
      expect(recipientRepo.update).toHaveBeenCalledWith(
        11,
        expect.objectContaining({ status: NotificationRecipientStatus.CONFIRMED }),
      );
      // Sólo el que seguía pendiente; el ya entregado (13) no se toca.
      expect(recipientRepo.update).toHaveBeenCalledWith([12], {
        status: NotificationRecipientStatus.CANCELED,
      });
      expect(notifications.createForEventTakenCharge).toHaveBeenCalledWith({
        referenceId: 70,
        groupId: 100,
        memberUserIds: [2, 3],
        payload: { dependentName: 'Tito Pérez', actorName: 'Ana Pérez', originalType: NotificationType.APPOINTMENT },
      });
      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          action: GroupEventAction.EVENT_TAKEN_CHARGE,
          targetType: GroupEventTargetType.APPOINTMENT,
          targetId: 70,
          actorUserId: 1,
        }),
      );
    });

    it('vale igual para una toma de medicamento', async () => {
      notificationRepo.findOne.mockResolvedValue(
        notification({
          type: NotificationType.MEDICATION,
          payload: null,
          recipients: [{ id: 11, userId: 1, status: NotificationRecipientStatus.PENDING }],
        }),
      );
      medEventRepo.findOne.mockResolvedValue({ id: 70, date: future() });
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE);

      expect(result.takenChargeByName).toBe('Alguien');
      expect(medEventRepo.update).toHaveBeenCalled();
      expect(appointmentRepo.update).not.toHaveBeenCalled();
      // Sin otros integrantes no hay a quién avisar ni avisos que cancelar.
      expect(notifications.createForEventTakenCharge).not.toHaveBeenCalled();
      expect(recipientRepo.update).toHaveBeenCalledTimes(1);
    });

    it('un error al avisar al grupo no deshace la toma de responsabilidad', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());
      notifications.createForEventTakenCharge.mockRejectedValue(new Error('fcm'));
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).resolves.toMatchObject({ status: 'taken_charge' });
    });

    it('respondToEvent busca el aviso del turno o de la toma', async () => {
      await expect(
        service.respondToEvent(GroupEventTargetType.APPOINTMENT, 70, 1, NotificationRecipientAction.TAKE_CHARGE),
      ).rejects.toThrow('Este evento no tiene una notificación grupal');
      expect(notificationRepo.findOne.mock.calls[0][0].where).toEqual({
        type: NotificationType.APPOINTMENT,
        referenceId: 70,
      });

      notificationRepo.findOne.mockResolvedValue(notification());
      await service.respondToEvent(GroupEventTargetType.MED_EVENT, 70, 1, NotificationRecipientAction.TAKE_CHARGE);
      expect(notificationRepo.findOne.mock.calls[1][0].where.type).toBe(NotificationType.MEDICATION);
    });
  });

  describe('"No puedo"', () => {
    beforeEach(() => {
      appointmentRepo.findOne.mockResolvedValue({ id: 70, date: future(), status: EventStatus.CREATED });
      userRepo.findOne.mockResolvedValue({ id: 1, firstName: 'Ana', lastName: 'Pérez' });
    });

    it('marca al integrante, avisa al resto (reciclando el aviso anterior) y lo registra', async () => {
      notificationRepo.findOne.mockResolvedValue(notification());

      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.DISCARD),
      ).resolves.toEqual({ status: 'discarded', declinedByName: 'Ana Pérez' });

      expect(recipientRepo.update).toHaveBeenCalledWith(
        11,
        expect.objectContaining({ status: NotificationRecipientStatus.DISCARDED }),
      );
      expect(notifications.deleteForReferences).toHaveBeenCalledWith([NotificationType.EVENT_DECLINED], [70]);
      expect(notifications.createForEventDeclined).toHaveBeenCalledWith(
        expect.objectContaining({ memberUserIds: [2, 3] }),
      );
      expect(logRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: GroupEventAction.EVENT_DECLINED }),
      );
      // "No puedo" no resuelve el evento.
      expect(appointmentRepo.update).not.toHaveBeenCalled();
    });

    it('sólo una vez por evento', async () => {
      notificationRepo.findOne.mockResolvedValue(
        notification({
          recipients: [{ id: 11, userId: 1, status: NotificationRecipientStatus.DISCARDED }],
        }),
      );
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.DISCARD),
      ).rejects.toThrow('Ya avisaste que no podés');
    });

    it('si es el único integrante no avisa a nadie; un error al avisar no corta', async () => {
      notificationRepo.findOne.mockResolvedValue(
        notification({ payload: null, recipients: [{ id: 11, userId: 1, status: NotificationRecipientStatus.PENDING }] }),
      );
      await service.respondToNotification(1, 1, NotificationRecipientAction.DISCARD);
      expect(notifications.createForEventDeclined).not.toHaveBeenCalled();

      notificationRepo.findOne.mockResolvedValue(notification());
      notifications.createForEventDeclined.mockRejectedValue(new Error('fcm'));
      await expect(
        service.respondToNotification(1, 1, NotificationRecipientAction.DISCARD),
      ).resolves.toMatchObject({ status: 'discarded' });
    });
  });

  describe('getMyResponses', () => {
    it('sin ids no consulta nada', async () => {
      await expect(service.getMyResponses(GroupEventTargetType.MED_EVENT, [], 1)).resolves.toEqual({});
      expect(notificationRepo.find).not.toHaveBeenCalled();
    });

    it('devuelve la acción del usuario por evento', async () => {
      notificationRepo.find.mockResolvedValue([
        { referenceId: 1, recipients: [{ userId: 1, action: 'discard' }] },
        { referenceId: 2, recipients: [{ userId: 2, action: 'take_charge' }] },
        { referenceId: 3, recipients: null },
      ]);
      await expect(
        service.getMyResponses(GroupEventTargetType.APPOINTMENT, [1, 2, 3], 1),
      ).resolves.toEqual({ 1: 'discard', 2: null, 3: null });
      expect(notificationRepo.find.mock.calls[0][0].where.type).toBe(NotificationType.APPOINTMENT);

      await service.getMyResponses(GroupEventTargetType.MED_EVENT, [1], 1);
      expect(notificationRepo.find.mock.calls[1][0].where.type).toBe(NotificationType.MEDICATION);
    });
  });

  describe('assertMembership (permisos de grupo)', () => {
    it('404 si el grupo no existe', async () => {
      await expect(service.assertMembership(100, 1)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('acepta al responsable y a los integrantes, rechaza al resto', async () => {
      familyGroupRepo.findOne.mockResolvedValue({ id: 100, createdBy: { id: 1 }, members: [{ id: 2 }] });
      await expect(service.assertMembership(100, 1)).resolves.toMatchObject({ id: 100 });
      await expect(service.assertMembership(100, 2)).resolves.toMatchObject({ id: 100 });
      await expect(service.assertMembership(100, 3)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('tolera un grupo sin responsable ni lista de integrantes', async () => {
      familyGroupRepo.findOne.mockResolvedValue({ id: 100, createdBy: null, members: null });
      await expect(service.assertMembership(100, 1)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getHistory', () => {
    beforeEach(() => {
      familyGroupRepo.findOne.mockResolvedValue({ id: 100, createdBy: { id: 1 }, members: [] });
    });

    it('exige pertenecer al grupo', async () => {
      await expect(service.getHistory(100, 99)).rejects.toBeInstanceOf(ForbiddenException);
      expect(logRepo.find).not.toHaveBeenCalled();
    });

    it('historial vacío', async () => {
      await expect(service.getHistory(100, 1)).resolves.toEqual({ total: 0, groups: [] });
      expect(userRepo.find).not.toHaveBeenCalled();
      expect(medEventRepo.find).not.toHaveBeenCalled();
    });

    it('agrupa por evento y por serie, deja sueltas las de integrantes y pagina', async () => {
      const t = (m: number) => new Date(Date.UTC(2026, 9, 20, 10, m));
      // Vienen del más nuevo al más viejo, como las ordena la consulta.
      logRepo.find.mockResolvedValue([
        { id: 8, actorUserId: 1, action: GroupEventAction.EVENT_CANCELED, targetType: GroupEventTargetType.MED_EVENT, targetId: 203, createdAt: t(8), payload: { treatment: true } },
        { id: 7, actorUserId: 2, action: GroupEventAction.EVENT_TAKEN_CHARGE, targetType: GroupEventTargetType.MED_EVENT, targetId: 202, createdAt: t(7), payload: {} },
        { id: 6, actorUserId: 1, action: GroupEventAction.MEMBER_REMOVED, targetType: GroupEventTargetType.MEMBER, targetId: 5, createdAt: t(6), payload: {} },
        { id: 5, actorUserId: 1, action: GroupEventAction.MEMBER_ADDED, targetType: GroupEventTargetType.MEMBER, targetId: 5, createdAt: t(5), payload: {} },
        { id: 4, actorUserId: 2, action: GroupEventAction.EVENT_TAKEN_CHARGE, targetType: GroupEventTargetType.APPOINTMENT, targetId: 70, createdAt: t(4), payload: {} },
        { id: 3, actorUserId: 1, action: GroupEventAction.EVENT_CREATED, targetType: GroupEventTargetType.APPOINTMENT, targetId: 70, createdAt: t(3), payload: { professionalName: 'Dra. Ruiz' } },
        { id: 2, actorUserId: null, action: GroupEventAction.EVENT_CREATED, targetType: GroupEventTargetType.MED_EVENT, targetId: 201, createdAt: t(2), payload: { medName: 'Amoxi' } },
        { id: 1, actorUserId: 1, action: GroupEventAction.EVENT_CREATED, targetType: GroupEventTargetType.MED_EVENT, targetId: 300, createdAt: t(1), payload: { medName: 'Suelta' } },
      ]);
      userRepo.find.mockResolvedValue([
        { id: 1, firstName: 'Ana', lastName: 'Pérez', photo: 'a.png' },
        { id: 2, firstName: 'Beto', lastName: 'Pérez' },
      ]);
      medEventRepo.find.mockResolvedValue([
        { id: 201, seriesId: 'S', doseIndex: 1 },
        { id: 202, seriesId: 'S', doseIndex: 2 },
        { id: 203, seriesId: 'S', doseIndex: 3 },
        { id: 300, seriesId: null, doseIndex: null },
      ]);

      const { total, groups } = await service.getHistory(100, 1);

      expect(total).toBe(5);
      expect(groups.map((g) => g.groupKey)).toEqual([
        'med_event:serie:S',
        'entry:6',
        'entry:5',
        'appointment:70',
        'med_event:300',
      ]);

      const serie = groups[0];
      expect(serie.grouped).toBe(true);
      expect(serie.entries.map((e) => e.id)).toEqual([2, 7, 8]);
      // La creación y la cancelación de la serie no llevan número de toma.
      expect(serie.entries.map((e) => e.doseIndex)).toEqual([null, 2, null]);
      expect(serie.title).toEqual({ medName: 'Amoxi' });
      expect(serie.lastEntry.id).toBe(8);
      expect(serie.entries[0].actorName).toBeNull();
      expect(serie.entries[2]).toMatchObject({ actorName: 'Ana Pérez', actorPhoto: 'a.png' });
      expect(serie.entries[1].actorPhoto).toBeNull();

      expect(groups[1].grouped).toBe(false);
      expect(groups[3].entries.map((e) => e.action)).toEqual([
        GroupEventAction.EVENT_CREATED,
        GroupEventAction.EVENT_TAKEN_CHARGE,
      ]);
      expect(groups[3].title).toEqual({ professionalName: 'Dra. Ruiz' });

      const page = await service.getHistory(100, 1, 2, 1);
      expect(page.total).toBe(5);
      expect(page.groups.map((g) => g.groupKey)).toEqual(['entry:6', 'entry:5']);
    });

    it('sin entrada de creación, el título sale de la más vieja', async () => {
      logRepo.find.mockResolvedValue([
        { id: 2, action: GroupEventAction.EVENT_CANCELED, targetType: GroupEventTargetType.APPOINTMENT, targetId: 1, payload: { b: 1 } },
        { id: 1, action: GroupEventAction.EVENT_TAKEN_CHARGE, targetType: GroupEventTargetType.APPOINTMENT, targetId: 1, payload: { a: 1 } },
      ]);
      const { groups } = await service.getHistory(100, 1);
      expect(groups[0].title).toEqual({ a: 1 });
    });
  });
});
