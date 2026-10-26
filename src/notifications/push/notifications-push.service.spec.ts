import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { NotificationDeviceToken } from '../entities/notification-device-token.entity';
import { NotificationsPushService } from './notifications-push.service';

const sendEachForMulticast = jest.fn();

// Firebase nunca se toca de verdad: ni credenciales ni red.
jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn(),
  credential: { cert: jest.fn((p) => ({ path: p })) },
  messaging: jest.fn(() => ({ sendEachForMulticast })),
}));

const firebase = admin as unknown as {
  apps: unknown[];
  initializeApp: jest.Mock;
  credential: { cert: jest.Mock };
};

describe('NotificationsPushService', () => {
  let service: NotificationsPushService;
  let deviceRepo: MockRepository;

  beforeEach(async () => {
    deviceRepo = mockRepository();
    firebase.apps.length = 0;
    firebase.initializeApp.mockReset();
    sendEachForMulticast.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsPushService,
        { provide: getRepositoryToken(NotificationDeviceToken), useValue: deviceRepo },
      ],
    }).compile();
    service = module.get(NotificationsPushService);

    for (const level of ['log', 'warn', 'error'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
  });

  afterEach(() => jest.restoreAllMocks());

  const payload = { title: 'Turno', body: 'Control', data: { referenceId: '70' } };

  describe('onModuleInit', () => {
    it('inicializa Firebase con la cuenta de servicio de la raíz', () => {
      service.onModuleInit();
      expect(firebase.credential.cert).toHaveBeenCalledWith(
        expect.stringMatching(/firebase-service-account\.json$/),
      );
      expect(firebase.initializeApp).toHaveBeenCalledTimes(1);
    });

    it('no inicializa dos veces si ya hay una app', () => {
      firebase.apps.push({});
      service.onModuleInit();
      expect(firebase.initializeApp).not.toHaveBeenCalled();
    });

    it('sin credenciales queda en modo simulación sin romper el arranque', async () => {
      firebase.initializeApp.mockImplementation(() => {
        throw new Error('no existe el archivo');
      });
      expect(() => service.onModuleInit()).not.toThrow();

      deviceRepo.find.mockResolvedValue([{ token: 'a' }, { token: 'b' }]);
      await expect(service.sendToUsers([1], payload)).resolves.toEqual({ sent: 2, failed: 0 });
      expect(sendEachForMulticast).not.toHaveBeenCalled();
    });
  });

  describe('sendToUsers', () => {
    it('sin usuarios o sin dispositivos no envía nada', async () => {
      await expect(service.sendToUsers([], payload)).resolves.toEqual({ sent: 0, failed: 0 });
      expect(deviceRepo.find).not.toHaveBeenCalled();
      await expect(service.sendToUsers([1], payload)).resolves.toEqual({ sent: 0, failed: 0 });
    });

    it('simulación sin data también cuenta los dispositivos', async () => {
      deviceRepo.find.mockResolvedValue([{ token: 'a' }]);
      await expect(service.sendToUsers([1], { title: 't', body: 'b' })).resolves.toEqual({ sent: 1, failed: 0 });
    });

    describe('con Firebase listo', () => {
      beforeEach(() => service.onModuleInit());

      it('manda un multicast al canal de alta prioridad sólo a dispositivos habilitados', async () => {
        deviceRepo.find.mockResolvedValue([{ token: 'tok-1' }, { token: 'tok-2' }]);
        sendEachForMulticast.mockResolvedValue({ responses: [{ success: true }, { success: true }] });

        await expect(service.sendToUsers([1, 2], payload)).resolves.toEqual({ sent: 2, failed: 0 });

        expect(deviceRepo.find.mock.calls[0][0].where.enabled).toBe(true);
        expect(deviceRepo.find.mock.calls[0][0].where.userId.value).toEqual([1, 2]);
        expect(sendEachForMulticast).toHaveBeenCalledWith({
          tokens: ['tok-1', 'tok-2'],
          notification: { title: 'Turno', body: 'Control' },
          data: { referenceId: '70' },
          android: {
            priority: 'high',
            notification: { channelId: 'sigsa_reminders', priority: 'high', defaultSound: true },
          },
        });
      });

      it('deshabilita los tokens que FCM da por inválidos y cuenta los fallos', async () => {
        deviceRepo.find.mockResolvedValue([
          { token: 'bueno-xxxxxxxxxxxxxxxxxxxx' },
          { token: 'vencido-xxxxxxxxxxxxxxxxxx' },
          { token: 'invalido-xxxxxxxxxxxxxxxxx' },
          { token: 'otro-error-xxxxxxxxxxxxxxx' },
        ]);
        deviceRepo.update.mockRejectedValueOnce(new Error('db')); // no debe romper
        sendEachForMulticast.mockResolvedValue({
          responses: [
            { success: true },
            { success: false, error: { code: 'messaging/registration-token-not-registered' } },
            { success: false, error: { code: 'messaging/invalid-registration-token' } },
            { success: false, error: { code: 'messaging/internal-error', message: 'boom' } },
          ],
        });

        await expect(service.sendToUsers([1], { title: 't', body: 'b' })).resolves.toEqual({ sent: 1, failed: 3 });

        expect(sendEachForMulticast.mock.calls[0][0].data).toEqual({});
        expect(deviceRepo.update).toHaveBeenCalledTimes(2);
        expect(deviceRepo.update).toHaveBeenCalledWith({ token: 'vencido-xxxxxxxxxxxxxxxxxx' }, { enabled: false });
        expect(deviceRepo.update).toHaveBeenCalledWith({ token: 'invalido-xxxxxxxxxxxxxxxxx' }, { enabled: false });
      });

      it('si FCM tira una excepción, todos cuentan como fallidos', async () => {
        deviceRepo.find.mockResolvedValue([{ token: 'a' }, { token: 'b' }]);
        sendEachForMulticast.mockRejectedValue(new Error('red'));
        await expect(service.sendToUsers([1], payload)).resolves.toEqual({ sent: 0, failed: 2 });
      });
    });
  });
});
