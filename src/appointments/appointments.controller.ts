import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Appointment } from './appointment.entity';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@Controller('appointments')
export class AppointmentsController {
  constructor(private appoinmentsService: AppointmentsService) {}

  @Get()
  getAppointments(): Promise<Appointment[]> {
    return this.appoinmentsService.getAppointments();
  }

  @Get(':id')
  getAppointment(@Param('id', ParseIntPipe) id: number): Promise<Appointment> {
    return this.appoinmentsService.getAppointmentById(id);
  }
  @Post()
  createAppointment(
    @Body() newAppoinment: CreateAppointmentDTO,
  ): Promise<Appointment> {
    return this.appoinmentsService.createAppointment(newAppoinment);
  }
}
