import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  createAppointment(appointment: CreateAppointmentDTO) {
    const newAppointment = this.appointmentRepository.create(appointment);
    return this.appointmentRepository.save(newAppointment);
  }

  getAppointments() {
    return this.appointmentRepository.find();
  }

  getAppointmentById(id: number) {
    return this.appointmentRepository.findOne({ where: { id } });
  }
}
