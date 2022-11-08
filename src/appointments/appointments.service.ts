import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Professional } from 'src/professionals/professional.entity';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  createAppointment(
    appointment: CreateAppointmentDTO,
    user: User,
    doctor: Professional,
  ) {
    const newAppointment = this.appointmentRepository.create({
      createdBy: user,
      doctor,
      date: appointment.date,
      description: appointment.comments,
    });
    return this.appointmentRepository.save(newAppointment);
  }

  getAppointments() {
    return this.appointmentRepository.find();
  }

  getAppointmentById(id: number) {
    return this.appointmentRepository.findOne({ where: { id } });
  }
}
