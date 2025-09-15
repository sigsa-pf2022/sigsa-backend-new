import { LessThan } from 'typeorm';
import { subDays } from 'date-fns';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { User } from 'src/users/entities/user.entity';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { In, Not, Raw, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
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

  createAppointmentWithProfessionalUser(
    appointment: CreateAppointmentDTO,
    creator: User | Dependent,
    professional: ProfessionalUser,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdById: creator.id,
      createdByType: this.getCreatorType(creator),
      date: appointment.date,
      description: appointment.description,
      professional,
    });
    return this.appointmentRepository.save(newAppointment);
  }

  async createAppointmentWithMyProfessional(
    appointment: CreateAppointmentDTO,
    creator: User | Dependent,
    myProfessional: Professionals,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdById: creator.id,
      createdByType: this.getCreatorType(creator),
      myProfessional,
      date: appointment.date,
      description: appointment.description,
    });
    return this.appointmentRepository.save(newAppointment);
  }

  getAppointmentsByUser(user: User) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: user.id,
        createdByType: 'user',
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getAppointmentsByDependent(dependent: Dependent) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getNextAppointmentsByUser(user: User) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: user.id,
        createdByType: 'user',
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }

  getNextAppointmentsByDependent(dependent: Dependent) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: dependent.id,
        createdByType: 'dependent',
        status: In([EventStatus.CREATED, EventStatus.CONFIRMED]),
        date: Raw((alias) => `${alias} > NOW()`),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'ASC',
      },
      take: 3,
    });
  }

  // Método genérico para obtener citas por creador
  getAppointmentsByCreator(creator: User | Dependent) {
    return this.appointmentRepository.find({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: {
        createdById: creator.id,
        createdByType: this.getCreatorType(creator),
        status: Not(EventStatus.CANCELED),
      },
      relations: {
        myProfessional: true,
        professional: true,
      },
      order: {
        date: 'DESC',
      },
    });
  }

  getAppointmentById(id: number) {
    return this.appointmentRepository.findOne({
      select: {
        professional: {
          id: true,
          firstName: true,
          lastName: true,
        },
        myProfessional: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      where: { id },
      relations: { myProfessional: true, professional: true },
    });
  }

  cancelAppointment(id: number) {
    return this.appointmentRepository.update(
      { id },
      {
        status: EventStatus.CANCELED,
        updatedAt: new Date(),
      },
    );
  }

  confirmAppointment(id: number) {
    return this.appointmentRepository.update(
      { id },
      {
        status: EventStatus.CONFIRMED,
        updatedAt: new Date(),
      },
    );
  }

  async updateAppointmentWithProfessionalUser(id: number, body) {
    return this.appointmentRepository.update(
      { id },
      {
        date: body.date,
        description: body.description,
        professional: body.professional,
        myProfessional: null,
        updatedAt: new Date(),
      },
    );
  }

  async updateAppointmentWithMyProfessional(id: number, body) {
    return this.appointmentRepository.update(
      { id },
      {
        date: body.date,
        description: body.description,
        myProfessional: body.myProfessional,
        professional: null,
        updatedAt: new Date(),
      },
    );
  }

  async cancelOldCreatedAppointments(): Promise<number> {
    const oneDayAgo = subDays(new Date(), 1);
    const appointmentsToCancel = await this.appointmentRepository.find({
      where: {
        status: EventStatus.CREATED,
        date: LessThan(oneDayAgo),
      },
    });
    if (appointmentsToCancel.length) {
      for (const appt of appointmentsToCancel) {
        appt.status = EventStatus.CANCELED;
        appt.updatedAt = new Date();
      }
      await this.appointmentRepository.save(appointmentsToCancel);
    }
    return appointmentsToCancel.length;
  }
}
