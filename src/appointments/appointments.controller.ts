import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { ProfessionalsService } from 'src/professionals/professionals.service';
import { UsersService } from 'src/users/users.service';
import { Appointment } from './appointment.entity';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private appoinmentsService: AppointmentsService,
    private userService: UsersService,
    private professionalsService: ProfessionalsService,
  ) {}

  @Get()
  getAppointments(): Promise<Appointment[]> {
    return this.appoinmentsService.getAppointments();
  }

  @Get(':id')
  getAppointment(@Param('id', ParseIntPipe) id: number): Promise<Appointment> {
    return this.appoinmentsService.getAppointmentById(id);
  }
  @Post('/create')
  async createAppointment(
    @Request() req,
    @Body() createAppointmentDto: CreateAppointmentDTO,
  ) {
    try {
      const user = await this.userService.getUserById(req.user.id);
      const doctor = await this.professionalsService.getProfessionalById(createAppointmentDto.doctorId);
      const appointment: Appointment =
        await this.appoinmentsService.createAppointment(
          createAppointmentDto,
          user,
          doctor
        );
      return { status: HttpStatus.CREATED, id: appointment.id };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el turno',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
