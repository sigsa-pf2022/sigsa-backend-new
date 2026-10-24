import { Test, TestingModule } from '@nestjs/testing';
import { MedsEventController } from './meds-event.controller';
import { MedsEventService } from './meds-event.service';
import { UsersService } from 'src/users/users.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';

describe('MedsEventController', () => {
  let controller: MedsEventController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MedsEventController],
      providers: [
        { provide: MedsEventService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: FamilyGroupsService, useValue: {} },
      ],
    }).compile();

    controller = module.get<MedsEventController>(MedsEventController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
