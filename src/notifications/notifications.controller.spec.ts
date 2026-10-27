import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MockRepository, mockRepository } from 'src/common/testing/mock-repository';
import { NotificationDeviceToken } from './entities/notification-device-token.entity';
import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let deviceRepo: MockRepository;
  const req = { user: { id: 1 } };

  beforeEach(async () => {
    deviceRepo = mockRepository();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: getRepositoryToken(NotificationDeviceToken), useValue: deviceRepo }],
    }).compile();
    controller = module.get(NotificationsController);
  });

  describe('POST /notifications/devices', () => {
    it('sin usuario autenticado: 401', async () => {
      await expect(controller.registerDevice({ token: 't', platform: 'android' } as any, {})).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('registra un token nuevo habilitado', async () => {
      deviceRepo.save.mockImplementation(async (d) => ({ ...d, id: 5 }));
      await expect(controller.registerDevice({ token: 't', platform: 'android' } as any, req)).resolves.toEqual({
        success: true,
        message: 'Dispositivo registrado',
        id: 5,
      });
      expect(deviceRepo.create).toHaveBeenCalledWith({ token: 't', platform: 'android', userId: 1, enabled: true });
    });

    it('un token existente pasa al usuario actual y se rehabilita', async () => {
      deviceRepo.findOne.mockResolvedValue({ id: 3, token: 't', userId: 9, enabled: false, platform: 'ios' });
      await expect(controller.registerDevice({ token: 't', platform: 'android' } as any, req)).resolves.toEqual({
        success: true,
        message: 'Dispositivo actualizado',
        id: 3,
      });
      expect(deviceRepo.save).toHaveBeenCalledWith({ id: 3, token: 't', userId: 1, enabled: true, platform: 'android' });
    });
  });

  describe('DELETE /notifications/devices/:token', () => {
    it('sin usuario autenticado: 401', async () => {
      await expect(controller.removeDevice('t', { user: {} })).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('sólo deshabilita tokens del propio usuario', async () => {
      await expect(controller.removeDevice('t', req)).resolves.toEqual({
        success: false,
        message: 'Dispositivo no encontrado',
      });
      expect(deviceRepo.findOne).toHaveBeenCalledWith({ where: { token: 't', userId: 1 } });

      deviceRepo.findOne.mockResolvedValue({ id: 3, enabled: true });
      await expect(controller.removeDevice('t', req)).resolves.toEqual({
        success: true,
        message: 'Dispositivo deshabilitado',
      });
      expect(deviceRepo.save).toHaveBeenCalledWith({ id: 3, enabled: false });
    });
  });
});
