import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { UsersService } from 'src/users/users.service';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

describe('EventsController', () => {
  let controller: EventsController;
  let events: { getEventsByUser: jest.Mock; getEventsByDependent: jest.Mock };
  let users: { getUserById: jest.Mock };
  let familyGroups: { getDependentById: jest.Mock };

  beforeEach(async () => {
    events = { getEventsByUser: jest.fn(async () => [{ id: 1 }]), getEventsByDependent: jest.fn(async () => [{ id: 2 }]) };
    users = { getUserById: jest.fn(async () => ({ id: 1 })) };
    familyGroups = { getDependentById: jest.fn(async () => ({ id: 10 })) };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsController],
      providers: [
        { provide: EventsService, useValue: events },
        { provide: UsersService, useValue: users },
        { provide: FamilyGroupsService, useValue: familyGroups },
      ],
    }).compile();
    controller = module.get<EventsController>(EventsController);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('GET /events: próximos del usuario del token', async () => {
    await expect(controller.getNextEvents({ user: { id: 1 } })).resolves.toEqual([{ id: 1 }]);
    expect(events.getEventsByUser).toHaveBeenCalledWith({ id: 1 });
  });

  it('GET /events/dependent/:id: 404 sin dependiente', async () => {
    familyGroups.getDependentById.mockResolvedValue(null);
    await expect(controller.getNextEventsByDependent(10)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /events/dependent/:id: delega y convierte errores en 500 con mensaje claro', async () => {
    await expect(controller.getNextEventsByDependent(10)).resolves.toEqual([{ id: 2 }]);
    expect(events.getEventsByDependent).toHaveBeenCalledWith({ id: 10 });
    events.getEventsByDependent.mockRejectedValue(new Error('db'));
    await expect(controller.getNextEventsByDependent(10)).rejects.toThrow(
      new InternalServerErrorException('No fue posible obtener los eventos del dependiente'),
    );
  });
});
