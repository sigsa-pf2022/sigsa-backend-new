import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { User } from 'src/users/entities/user.entity';
import { In, Not, Raw, Repository } from 'typeorm';
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
        createdBy: { id: user.id },
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

  getNextMedsEventByUser(user: User) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdBy: { id: user.id },
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        med: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }
  
  async createMedEvent(user: User, createMedEventDto: CreateMedEventDto) {
    const newMedEvent = this.medEventRepository.create({
      createdBy: user,
      med: createMedEventDto.med,
      date: createMedEventDto.date,
    });
    return this.medEventRepository.save(newMedEvent);
  }
}
