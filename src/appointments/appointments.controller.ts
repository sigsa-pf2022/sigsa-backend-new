import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
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
  async getAppointmentsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const res: Appointment[] =
      await this.appoinmentsService.getAppointmentsByUser(user);
    console.log(res);
    const appointments = res.map((a) => {
      return {
        professional: a.myProfessional ? a.myProfessional : a.professional,
        date: a.date,
      };
    });
    return appointments;
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
      let appointment: Appointment;
      if (createAppointmentDto.myProfessional) {
        const myProfessional: Professionals =
          await this.professionalsService.getMyProfessionalById(
            createAppointmentDto.myProfessional.id,
          );
        appointment =
          await this.appoinmentsService.createAppointmentWithMyProfessional(
            createAppointmentDto,
            user,
            myProfessional,
          );
      } else {
        const professional: ProfessionalUser =
          await this.professionalsService.getProfessionalById(
            createAppointmentDto.professional.id,
          );
        appointment =
          await this.appoinmentsService.createAppointmentWithProfessionalUser(
            createAppointmentDto,
            user,
            professional,
          );
      }
      return { status: HttpStatus.CREATED, appointment };
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
