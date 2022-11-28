import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { User } from 'src/users/entities/user.entity';
import { Not, Repository } from 'typeorm';
import { Meds } from '../meds/meds.entity';
import { CreateMedEventDto } from './dto/create-med-event.dto';
import { MedEvent } from './med-event.entity';

@Injectable()
export class MedsEventService {
  constructor(
    @InjectRepository(MedEvent)
    private medEventRepository: Repository<MedEvent>,
  ) {}

  getMedsEventsByUser(user: User) {
    return this.medEventRepository.find({
      where: {
        createdBy: user,
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        med: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }
  async createMedEvent(
    user: User,
    createMedEventDto: CreateMedEventDto,
  ) {
    const newMedEvent = this.medEventRepository.create({
      createdBy: user,
      med: createMedEventDto.med,
      date: createMedEventDto.date,
    });
    return this.medEventRepository.save(newMedEvent);
  }
}
