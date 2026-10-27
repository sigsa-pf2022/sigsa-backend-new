import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationRecipientAction } from 'src/notifications/enums/notification-recipient-action.enum';
import { GroupEventTargetType } from './enums/group-event-action.enum';
import { GroupEventsController } from './group-events.controller';
import { GroupEventsService } from './group-events.service';

describe('GroupEventsController', () => {
  let controller: GroupEventsController;
  let service: Record<'respondToNotification' | 'respondToEvent' | 'getMyResponses' | 'getHistory', jest.Mock>;
  const req = { user: { id: '7' } };
  const dto = { action: NotificationRecipientAction.TAKE_CHARGE };

  beforeEach(async () => {
    service = {
      respondToNotification: jest.fn(async () => ({ status: 'taken_charge' })),
      respondToEvent: jest.fn(async () => ({ status: 'taken_charge' })),
      getMyResponses: jest.fn(async () => ({})),
      getHistory: jest.fn(async () => ({ total: 0, groups: [] })),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GroupEventsController],
      providers: [{ provide: GroupEventsService, useValue: service }],
    }).compile();
    controller = module.get(GroupEventsController);
  });

  it('respond delega con el id del token como número', async () => {
    await expect(controller.respond(1, req, dto as any)).resolves.toEqual({ status: 'taken_charge' });
    expect(service.respondToNotification).toHaveBeenCalledWith(1, 7, NotificationRecipientAction.TAKE_CHARGE);
  });

  it('respond propaga los errores del servicio', async () => {
    service.respondToNotification.mockRejectedValue(new ConflictException('Otro integrante ya se hizo cargo'));
    await expect(controller.respond(1, req, dto as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('respondToEvent valida el tipo de evento', async () => {
    await expect(controller.respondToEvent('document', 1, req, dto as any)).rejects.toBeInstanceOf(BadRequestException);
    await controller.respondToEvent('med_event', 3, req, dto as any);
    await controller.respondToEvent('appointment', 4, req, dto as any);
    expect(service.respondToEvent).toHaveBeenCalledWith(GroupEventTargetType.MED_EVENT, 3, 7, dto.action);
    expect(service.respondToEvent).toHaveBeenCalledWith(GroupEventTargetType.APPOINTMENT, 4, 7, dto.action);
  });

  it('getMyResponses valida el tipo y descarta ids inválidos', async () => {
    await expect(controller.getMyResponses('x', '1', req)).rejects.toBeInstanceOf(BadRequestException);
    await controller.getMyResponses('med_event', '1,abc,-2,3.5,4', req);
    expect(service.getMyResponses).toHaveBeenCalledWith(GroupEventTargetType.MED_EVENT, [1, 4], 7);
    await controller.getMyResponses('appointment', undefined, req);
    expect(service.getMyResponses).toHaveBeenLastCalledWith(GroupEventTargetType.APPOINTMENT, [], 7);
  });

  it('getHistory usa 50/0 por defecto y respeta la paginación', async () => {
    await controller.getHistory(100, req);
    expect(service.getHistory).toHaveBeenCalledWith(100, 7, 50, 0);
    await controller.getHistory(100, req, '10', '20');
    expect(service.getHistory).toHaveBeenLastCalledWith(100, 7, 10, 20);
  });
});
