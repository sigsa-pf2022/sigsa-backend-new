import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
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
      description: appointment.comments,
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
      description: appointment.comments,
    });
    return this.appointmentRepository.save(newAppointment);
  }

  getAppointmentsByUser(user: User) {
    return this.appointmentRepository.find({
      where: { createdBy: user },
      relations: {
        myProfessional:true,
        professional: true
      }
    });
  }

  getAppointmentById(id: number) {
    return this.appointmentRepository.findOne({ where: { id } });
  }
}
