import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { User } from 'src/users/entities/user.entity';
import { Not, Raw, Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  createAppointmentWithProfessionalUser(
    appointment: CreateAppointmentDTO,
    user: User,
    professional: ProfessionalUser,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdBy: user,
      date: appointment.date,
      description: appointment.description,
      professional,
    });
    return this.appointmentRepository.save(newAppointment);
  }

  async createAppointmentWithMyProfessional(
    appointment: CreateAppointmentDTO,
    user: User,
    myProfessional: Professionals,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdBy: user,
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
        createdBy: user,
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
        createdBy: user,
        status: EventStatus.CREATED,
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
      },
    );
  }
}
