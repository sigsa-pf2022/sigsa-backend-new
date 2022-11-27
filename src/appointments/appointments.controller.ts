import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { ProfessionalUser } from '../professionals/entities/professional-user.entity';
import { ProfessionalsService } from 'src/professionals/professionals.service';
import { UsersService } from 'src/users/users.service';
import { Appointment } from './appointment.entity';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDTO } from './dto/create-appointment.dto';
import { Professionals } from '../professionals/entities/my-professional.entity';
import { formatISO } from 'date-fns';

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
    const appointments = res.map((a) => {
      return {
        professional: a.myProfessional ? a.myProfessional : a.professional,
        date: a.date,
        id: a.id,
        status: a.status,
      };
    });
    return appointments;
  }

  @Get(':id')
  async getAppointment(@Param('id', ParseIntPipe) id: number) {
    const appointment = await this.appoinmentsService.getAppointmentById(id);
    return {
      professional: appointment.myProfessional
        ? appointment.myProfessional
        : appointment.professional,
      isMyProfessional: appointment.myProfessional ? true : false,
      date: formatISO(new Date(appointment.date.toLocaleString())),
      description: appointment.description,
    };
  }

  @Delete('/cancel/:id')
  cancelAppointment(@Request() req) {
    return this.appoinmentsService.cancelAppointment(req.params.id);
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
      const appt = {
        professional: appointment.myProfessional
          ? appointment.myProfessional
          : appointment.professional,
        date: appointment.date,
        description: appointment.description,
      };
      return { status: HttpStatus.CREATED, appointment: appt };
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

  // @Put('/update')
  // async editAppointment(
  //   @Request() req,
  //   @Body() createAppointmentDto: CreateAppointmentDTO,
  // ) {
  //   try {
  //     const user = await this.userService.getUserById(req.user.id);
  //     let appointment: Appointment;
  //     if (createAppointmentDto.myProfessional) {
  //       const myProfessional: Professionals =
  //         await this.professionalsService.getMyProfessionalById(
  //           createAppointmentDto.myProfessional.id,
  //         );
  //       appointment =
  //         await this.appoinmentsService.editAppointmentWithMyProfessional(
  //           createAppointmentDto,
  //           user,
  //           myProfessional,
  //         );
  //     } else {
  //       const professional: ProfessionalUser =
  //         await this.professionalsService.getProfessionalById(
  //           createAppointmentDto.professional.id,
  //         );
  //       appointment =
  //         await this.appoinmentsService.createAppointmentWithProfessionalUser(
  //           createAppointmentDto,
  //           user,
  //           professional,
  //         );
  //     }
  //     const appt = {
  //       professional: appointment.myProfessional
  //         ? appointment.myProfessional
  //         : appointment.professional,
  //       date: appointment.date,
  //       description: appointment.description,
  //     };
  //     return { status: HttpStatus.CREATED, appointment: appt };
  //   } catch (error) {
  //     throw new HttpException(
  //       {
  //         message: 'No se pudo crear el turno',
  //         status: 'error',
  //       },
  //       HttpStatus.BAD_REQUEST,
  //     );
  //   }
  // }
}
