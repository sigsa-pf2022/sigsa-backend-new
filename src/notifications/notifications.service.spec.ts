import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { NotificationRecipient } from './entities/notification-recipient.entity';
import { Notification } from './entities/notification.entity';
import { NotificationRecipientStatus } from './enums/notification-recipient-status.enum';
import { NotificationStatus } from './enums/notification-status.enum';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: MockRepository;
  let recipientRepo: MockRepository;

  beforeEach(async () => {
    notificationRepo = mockRepository();
    recipientRepo = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: getRepositoryToken(NotificationRecipient), useValue: recipientRepo },
      ],
    }).compile();
    service = module.get(NotificationsService);
  });

  describe('creación (idempotente por tipo, evento y grupo)', () => {
    it('crea la notificación y un destinatario PENDING por integrante', async () => {
      notificationRepo.save.mockImplementation(async (n) => ({ ...n, id: 1 }));
      notificationRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 1, recipients: [{ userId: 1 }, { userId: 2 }] });
      const scheduledFor = new Date('2026-10-30T10:00:00Z');

      const result = await service.createForAppointmentGroup({
        appointmentId: 70,
        groupId: 100,
        scheduledFor,
        leadMinutes: 15,
        memberUserIds: [1, 2],
        payload: { professionalName: 'Julia' },
      });

      expect(notificationRepo.findOne.mock.calls[0][0].where).toEqual({
        type: NotificationType.APPOINTMENT,
        referenceId: 70,
        groupId: 100,
      });
      expect(notificationRepo.save).toHaveBeenCalledWith({
        type: NotificationType.APPOINTMENT,
        referenceId: 70,
        groupId: 100,
        scheduledFor,
        leadMinutes: 15,
        payload: { professionalName: 'Julia' },
        status: NotificationStatus.CREATED,
      });
      expect(recipientRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ notificationId: 1, userId: 1, status: NotificationRecipientStatus.PENDING }),
        expect.objectContaining({ notificationId: 1, userId: 2, status: NotificationRecipientStatus.PENDING }),
      ]);
      expect(result.recipients).toHaveLength(2);
    });

    it('si ya existe, sólo agrega los integrantes que faltan', async () => {
      notificationRepo.findOne.mockResolvedValueOnce({ id: 1, recipients: [{ userId: 1 }] });
      await service.createForMedEventGroup({
        medEventId: 5,
        groupId: null,
        scheduledFor: new Date(),
        memberUserIds: [1, 3],
      });
      expect(notificationRepo.save).not.toHaveBeenCalled();
      expect(recipientRepo.save.mock.calls[0][0].map((r) => r.userId)).toEqual([3]);
    });

    it('si no hay integrantes nuevos no escribe nada', async () => {
      const existing = { id: 1, recipients: [{ userId: 1 }] };
      notificationRepo.findOne.mockResolvedValueOnce(existing);
      await expect(
        service.createForEventTakenCharge({ referenceId: 5, groupId: 1, memberUserIds: [1] }),
      ).resolves.toBe(existing);
      expect(recipientRepo.save).not.toHaveBeenCalled();
    });

    it.each([
      ['createForMedEventGroup', { medEventId: 5, groupId: 0, scheduledFor: new Date(), memberUserIds: [1] }, NotificationType.MEDICATION, 60, null],
      ['createForEventTakenCharge', { referenceId: 5, groupId: 2, memberUserIds: [1] }, NotificationType.EVENT_TAKEN_CHARGE, 0, 2],
      ['createForEventDeclined', { referenceId: 5, groupId: 2, memberUserIds: [1] }, NotificationType.EVENT_DECLINED, 0, 2],
      ['createForProfessionalLinkRequest', { patientProfessionalId: 5, memberUserIds: [1] }, NotificationType.PROFESSIONAL_LINK_REQUEST, 0, null],
      ['createForProfessionalLinkAccepted', { patientProfessionalId: 5, professionalUserId: 1 }, NotificationType.PROFESSIONAL_LINK_ACCEPTED, 0, null],
      ['createForProfessionalNote', { noteId: 5, groupId: null, memberUserIds: [1] }, NotificationType.PROFESSIONAL_NOTE, 0, null],
    ])('%s crea el tipo y la anticipación correctos', async (method, params, type, leadMinutes, groupId) => {
      notificationRepo.save.mockImplementation(async (n) => ({ ...n, id: 9 }));
      await (service as any)[method](params);
      expect(notificationRepo.save.mock.calls[0][0]).toMatchObject({
        type,
        referenceId: 5,
        leadMinutes,
        groupId,
        payload: null,
      });
      expect(recipientRepo.save.mock.calls[0][0][0].userId).toBe(1);
    });
  });

  describe('cancelForReferences', () => {
    it('sin ids o sin notificaciones no hace nada', async () => {
      await expect(service.cancelForReferences(NotificationType.MEDICATION, [])).resolves.toEqual({ canceled: 0 });
      await expect(service.cancelForReferences(NotificationType.MEDICATION, null)).resolves.toEqual({ canceled: 0 });
      await expect(service.cancelForReferences(NotificationType.MEDICATION, [1])).resolves.toEqual({ canceled: 0 });
      expect(notificationRepo.update).not.toHaveBeenCalled();
    });

    it('cancela sólo los destinatarios pendientes y las notificaciones', async () => {
      notificationRepo.find.mockResolvedValue([
        { id: 1, recipients: [{ id: 11, status: NotificationRecipientStatus.PENDING }, { id: 12, status: NotificationRecipientStatus.DELIVERED }] },
        { id: 2, recipients: null },
      ]);
      await expect(service.cancelForReferences(NotificationType.MEDICATION, [5, 6])).resolves.toEqual({ canceled: 2 });
      expect(recipientRepo.update).toHaveBeenCalledWith([11], { status: NotificationRecipientStatus.CANCELED });
      expect(notificationRepo.update.mock.calls[0][0].id.value).toEqual([1, 2]);
      expect(notificationRepo.update.mock.calls[0][1]).toEqual({ status: NotificationStatus.CANCELED });
    });

    it('si ya no quedan pendientes, sólo marca las notificaciones', async () => {
      notificationRepo.find.mockResolvedValue([{ id: 1, recipients: [{ id: 11, status: NotificationRecipientStatus.DELIVERED }] }]);
      await service.cancelForReferences(NotificationType.APPOINTMENT, [5]);
      expect(recipientRepo.update).not.toHaveBeenCalled();
      expect(notificationRepo.update).toHaveBeenCalled();
    });
  });

  describe('deleteForReferences', () => {
    it('sin ids, sin tipos o sin notificaciones no borra nada', async () => {
      await expect(service.deleteForReferences([NotificationType.MEDICATION], [])).resolves.toEqual({ deleted: 0 });
      await expect(service.deleteForReferences([], [1])).resolves.toEqual({ deleted: 0 });
      await expect(service.deleteForReferences([NotificationType.MEDICATION], [1])).resolves.toEqual({ deleted: 0 });
      expect(notificationRepo.delete).not.toHaveBeenCalled();
    });

    it('borra destinatarios y notificaciones', async () => {
      notificationRepo.find.mockResolvedValue([{ id: 1 }, { id: 2 }]);
      await expect(
        service.deleteForReferences([NotificationType.MEDICATION, NotificationType.EVENT_TAKEN_CHARGE], [5]),
      ).resolves.toEqual({ deleted: 2 });
      expect(recipientRepo.delete.mock.calls[0][0].notificationId.value).toEqual([1, 2]);
      expect(notificationRepo.delete.mock.calls[0][0].id.value).toEqual([1, 2]);
    });
  });
});
