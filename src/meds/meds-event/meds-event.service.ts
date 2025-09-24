import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
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

  // Helper para determinar el tipo de creador
  private getCreatorType(creator: User | Dependent | ProfessionalUser): string {
    if (creator instanceof Dependent) {
      return 'dependent';
    } else if (creator instanceof ProfessionalUser) {
      return 'professional';
    } else {
      return 'user';
    }
  }

  getMedsEventsByUser(user: User) {
    return this.medEventRepository.find({
      where: {
        createdById: user.id,
        createdByType: 'user',
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

  getMedsEventsByDependent(dependent: Dependent) {
    return this.medEventRepository.find({
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
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

  getNextMedsEventsByUser(user: User) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdById: user.id,
        createdByType: 'user',
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

  getNextMedsEventsByDependent(dependent: Dependent) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
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

  // Método genérico para obtener eventos por creador
  getMedsEventsByCreator(creator: User | Dependent) {
    return this.medEventRepository.find({
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
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

  // Método genérico para obtener próximos eventos por creador
  getNextMedsEventsByCreator(creator: User | Dependent) {
    return this.medEventRepository.find({
      select: {
        med: {
          id: true,
          name: true,
        },
      },
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
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
  
  async createMedEvent(creator: User | Dependent, createMedEventDto: CreateMedEventDto) {
    const dateObj = new Date(createMedEventDto.date);
    if (isNaN(dateObj.getTime())) {
      throw new Error('Fecha inválida');
    }
    const newMedEvent = this.medEventRepository.create({
      createdById: creator.id,
      createdByType: this.getCreatorType(creator),
      med: { id: createMedEventDto.medId } as any,
      date: dateObj,
    });
    try {
      return await this.medEventRepository.save(newMedEvent);
    } catch (e) {
      throw e;
    }
  }

  async updateMedEvent(id: number, updateData: Partial<CreateMedEventDto>) {
    return this.medEventRepository.update(id, {
      ...updateData,
      updatedAt: new Date(),
    });
  }

  async cancelMedEvent(id: number) {
    return this.medEventRepository.update(id, {
      status: EventStatus.CANCELED,
      updatedAt: new Date(),
    });
  }

  async confirmMedEvent(id: number) {
    return this.medEventRepository.update(id, {
      status: EventStatus.CONFIRMED,
      updatedAt: new Date(),
    });
  }

  getMedEventById(id: number) {
    return this.medEventRepository.findOne({
      where: { id },
      relations: { med: true },
    });
  }
}
