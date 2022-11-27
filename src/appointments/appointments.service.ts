import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventStatus } from 'src/events/entities/notification-event.entity';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { User } from 'src/users/entities/user.entity';
import { Not, Repository } from 'typeorm';
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
      },
    );
  }
}
