import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { NotificationRecipient } from '../entities/notification-recipient.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationRecipientStatus as R } from '../enums/notification-recipient-status.enum';
import { NotificationStatus } from '../enums/notification-status.enum';
import { NotificationsPushService } from '../push/notifications-push.service';
import { NotificationSchedulerService } from './notification-scheduler.service';

describe('NotificationSchedulerService', () => {
  let service: NotificationSchedulerService;
  let notificationRepo: MockRepository;
  let recipientRepo: MockRepository;
  let push: { sendToUsers: jest.Mock };

  const MIN = 60_000;
  const due = (overrides: any = {}) => ({
    id: 1,
    type: 'appointment',
    groupId: 100,
    referenceId: 70,
    scheduledFor: new Date(Date.now() + 10 * MIN),
    leadMinutes: 15,
    status: NotificationStatus.CREATED,
    payload: {},
    recipients: [
      { id: 11, userId: 1, status: R.PENDING },
      { id: 12, userId: 2, status: R.PENDING },
    ],
    ...overrides,
  });

  beforeEach(async () => {
    notificationRepo = mockRepository();
    recipientRepo = mockRepository();
    push = { sendToUsers: jest.fn(async () => ({ sent: 1, failed: 0 })) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSchedulerService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepo },
        { provide: getRepositoryToken(NotificationRecipient), useValue: recipientRepo },
        { provide: NotificationsPushService, useValue: push },
      ],
    }).compile();
    service = module.get(NotificationSchedulerService);
  });

  /** Corre un barrido y devuelve el payload que se mandó por push. */
  const dispatch = async (notification: any) => {
    notificationRepo.find.mockResolvedValue([notification]);
    await service.dispatchDueNotifications();
    return push.sendToUsers.mock.calls[0]?.[1];
  };

  describe('dispatchDueNotifications', () => {
    it('busca un lote de 50 notificaciones CREATED por orden de fecha', async () => {
      await service.dispatchDueNotifications();
      expect(notificationRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: NotificationStatus.CREATED }, take: 50, order: { scheduledFor: 'ASC' } }),
      );
    });

    it('no envía lo que todavía no está en ventana', async () => {
      notificationRepo.find.mockResolvedValue([due({ scheduledFor: new Date(Date.now() + 60 * MIN) })]);
      await service.dispatchDueNotifications();
      expect(push.sendToUsers).not.toHaveBeenCalled();
    });

    it('envía a los pendientes, los marca entregados y recalcula el estado', async () => {
      const n = due();
      notificationRepo.find.mockResolvedValue([n]);
      notificationRepo.findOne.mockResolvedValue({
        ...n,
        recipients: [{ status: R.DELIVERED }, { status: R.DELIVERED }],
      });

      await service.dispatchDueNotifications();

      expect(push.sendToUsers).toHaveBeenCalledWith([1, 2], expect.objectContaining({ title: 'Turno' }));
      expect(recipientRepo.update).toHaveBeenCalledWith(
        [11, 12],
        expect.objectContaining({ status: R.DELIVERED, deliveredAt: expect.any(Date) }),
      );
      expect(notificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: NotificationStatus.SENT }));
    });

    it('si no se pudo enviar a ningún dispositivo, los destinatarios siguen pendientes', async () => {
      push.sendToUsers.mockResolvedValue({ sent: 0, failed: 0 });
      await dispatch(due());
      expect(recipientRepo.update).not.toHaveBeenCalled();
    });

    it('sin pendientes sólo recalcula el estado', async () => {
      const n = due({ recipients: [{ id: 11, status: R.CONFIRMED }, { id: 12, status: R.CANCELED }] });
      notificationRepo.find.mockResolvedValue([n]);
      notificationRepo.findOne.mockResolvedValue(n);
      await service.dispatchDueNotifications();
      expect(push.sendToUsers).not.toHaveBeenCalled();
      expect(notificationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: NotificationStatus.COMPLETED }));
    });

    it('no corre dos barridos superpuestos', async () => {
      let release: () => void;
      notificationRepo.find.mockReturnValueOnce(new Promise((r) => (release = () => r([]))));
      const first = service.dispatchDueNotifications();
      await service.dispatchDueNotifications();
      expect(notificationRepo.find).toHaveBeenCalledTimes(1);
      release();
      await first;
      await service.dispatchDueNotifications();
      expect(notificationRepo.find).toHaveBeenCalledTimes(2);
    });

    it('libera el candado aunque el barrido falle', async () => {
      notificationRepo.find.mockRejectedValueOnce(new Error('db'));
      await expect(service.dispatchDueNotifications()).rejects.toThrow('db');
      await service.dispatchDueNotifications();
      expect(notificationRepo.find).toHaveBeenCalledTimes(2);
    });
  });

  describe('recálculo del estado', () => {
    const recompute = async (statuses: R[], current = NotificationStatus.CREATED) => {
      notificationRepo.find.mockResolvedValue([due({ recipients: statuses.map((s, i) => ({ id: i, status: s })) })]);
      notificationRepo.findOne.mockResolvedValue({
        id: 1,
        status: current,
        recipients: statuses.map((s) => ({ status: s })),
      });
      push.sendToUsers.mockResolvedValue({ sent: 0, failed: 0 });
      await service.dispatchDueNotifications();
      return notificationRepo.save.mock.calls[0]?.[0]?.status ?? null;
    };

    it('pendientes y entregados mezclados: PARTIALLY_SENT', async () => {
      await expect(recompute([R.PENDING, R.DELIVERED])).resolves.toBe(NotificationStatus.PARTIALLY_SENT);
    });

    it('todos respondieron o se cancelaron: COMPLETED', async () => {
      await expect(recompute([R.DISCARDED, R.CANCELED])).resolves.toBe(NotificationStatus.COMPLETED);
    });

    it('no guarda si el estado no cambia', async () => {
      await expect(recompute([R.DELIVERED], NotificationStatus.SENT)).resolves.toBeNull();
    });

    it('notificación borrada o sin destinatarios: no hace nada', async () => {
      notificationRepo.find.mockResolvedValue([due({ recipients: [] })]);
      await service.dispatchDueNotifications();
      notificationRepo.find.mockResolvedValue([due({ recipients: null })]);
      notificationRepo.findOne.mockResolvedValue({ id: 1, recipients: null });
      await service.dispatchDueNotifications();
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('texto de la push', () => {
    it('turno de dependiente: título con el nombre y datos para el "Me hago cargo"', async () => {
      const payload = await dispatch(
        due({ payload: { dependentName: 'tito pérez', dependentId: 10, professionalName: 'julia ruiz' } }),
      );
      expect(payload).toEqual({
        title: 'Turno de Tito Pérez',
        body: 'Julia Ruiz',
        data: {
          notificationId: '1',
          type: 'appointment',
          referenceId: '70',
          actionable: 'true',
          selfAppointment: 'false',
          groupId: '100',
          dependentId: '10',
          dependentName: 'Tito Pérez',
        },
      });
    });

    it('turno propio con profesional: "Turno con ..." y sin "Me hago cargo"', async () => {
      const payload = await dispatch(due({ groupId: null, payload: { professionalName: 'julia ruiz', description: 'Control' } }));
      expect(payload.title).toBe('Turno con Julia Ruiz');
      expect(payload.body).toBe('Control');
      expect(payload.data).toMatchObject({ actionable: 'false', selfAppointment: 'true' });
      expect(payload.data).not.toHaveProperty('groupId');
    });

    it('turno propio sin profesional: título genérico', async () => {
      const payload = await dispatch(due({ groupId: null, payload: { professionalName: 'Profesional' } }));
      expect(payload).toMatchObject({ title: 'Turno', body: 'Profesional' });
    });

    it('medicamento: el nombre va tal cual (con unidades); sin datos dice "Recordatorio"', async () => {
      let payload = await dispatch(due({ type: 'medication', payload: { medName: 'Ibuprofeno 400mg' } }));
      expect(payload).toMatchObject({ title: 'Medicamento', body: 'Ibuprofeno 400mg' });
      push.sendToUsers.mockClear();
      payload = await dispatch(due({ type: 'medication', payload: null }));
      expect(payload.body).toBe('Recordatorio');
    });

    it.each([
      ['professional_link_request', { professionalName: 'julia ruiz', dependentName: 'tito' }, 'Solicitud de vinculación de Tito', 'Julia Ruiz solicita vincularse como profesional.'],
      ['professional_link_request', null, 'Solicitud de vinculación', 'Un profesional solicita vincularse como profesional.'],
      ['professional_link_accepted', { message: 'Aceptada.' }, 'Vinculación aceptada', 'Aceptada.'],
      ['professional_link_accepted', {}, 'Vinculación aceptada', 'Tu solicitud de vinculación fue aceptada.'],
      ['professional_linked', { professionalName: 'julia' }, 'Nuevo profesional vinculado', 'Julia te agregó como paciente y puede ver tus documentos.'],
      ['professional_linked', {}, 'Nuevo profesional vinculado', 'Un profesional te agregó como paciente y puede ver tus documentos.'],
      ['professional_note', { professionalName: 'julia', dependentName: 'tito', excerpt: 'Dar con comida' }, 'Nueva indicación de Dr/a Julia', 'Para Tito: Dar con comida'],
      ['professional_note', {}, 'Nueva indicación de Dr/a tu profesional', 'Tocá para verla.'],
      ['event_taken_charge', { actorName: 'ana', originalType: 'appointment', dependentName: 'tito' }, 'Ana se hizo cargo', 'Se va a ocupar del turno de Tito.'],
      ['event_taken_charge', { originalType: 'medication' }, 'Un integrante se hizo cargo', 'Se va a ocupar del medicamento.'],
      ['event_declined', { actorName: 'ana', originalType: 'appointment' }, 'Ana no puede', 'No va a poder ocuparse del turno. Sigue sin resolver.'],
      ['event_declined', {}, 'Un integrante no puede', 'No va a poder ocuparse del medicamento. Sigue sin resolver.'],
    ])('%s → título y cuerpo', async (type, payload, title, body) => {
      const sent = await dispatch(due({ type, payload }));
      expect(sent.title).toBe(title);
      expect(sent.body).toBe(body);
      expect(sent.data.actionable).toBe('false');
    });

    it('el aviso de "se hizo cargo" lleva el tipo original para el deep link', async () => {
      const sent = await dispatch(due({ type: 'event_taken_charge', payload: { originalType: 'medication' } }));
      expect(sent.data.originalType).toBe('medication');
    });
  });
});
