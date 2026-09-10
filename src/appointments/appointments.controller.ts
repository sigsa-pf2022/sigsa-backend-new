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
import { EditAppointmentDto } from './dto/edit-appointment.dto';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(
    private appoinmentsService: AppointmentsService,
    private userService: UsersService,
    private professionalsService: ProfessionalsService,
    private familyGroupsService: FamilyGroupsService,
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

  @Get('dependent/:id')
  async getAppointmentsByDependentId(@Param('id', ParseIntPipe) dependentId: number) {
    const dependent = await this.familyGroupsService.getDependentById(dependentId);
    if (!dependent) {
      throw new HttpException(
        {
          message: 'Dependiente no encontrado',
          status: 'error',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    
    const res: Appointment[] =
      await this.appoinmentsService.getAppointmentsByDependent(dependent);
    const appointments = res.map((a) => {
      return {
        professional: a.myProfessional ? a.myProfessional : a.professional,
        date: a.date,
        id: a.id,
        status: a.status,
        description: a.description,
      };
    });
    return appointments;
  }

  @Get(':id')
  async getAppointment(@Param('id', ParseIntPipe) id: number) {
    const appointment = await this.appoinmentsService.getAppointmentById(id);
    return {
      // El id lo necesita la vista para "Me hago cargo"; el estado, para el badge.
      id: appointment.id,
      professional: appointment.myProfessional
        ? appointment.myProfessional
        : appointment.professional,
      isMyProfessional: appointment.myProfessional ? true : false,
      date: appointment.date,
      description: appointment.description,
      status: appointment.status,
      takenChargeByUserId: appointment.takenChargeByUserId,
      takenChargeBy: appointment.takenChargeBy,
      takenChargeAt: appointment.takenChargeAt,
    };
  }

  @Delete('/cancel/:id')
  cancelAppointment(@Request() req) {
    // El id del que cancela va al historial del grupo.
    return this.appoinmentsService.cancelAppointment(
      Number(req.params.id),
      Number(req.user.id),
    );
  }

  @Put('/confirm/:id')
  confirmAppointment(@Request() req) {
    return this.appoinmentsService.confirmAppointment(req.params.id);
  }

  @Post('/create')
  async createAppointment(
    @Request() req,
    @Body() createAppointmentDto: CreateAppointmentDTO,
  ) {
    try {
      console.log('Datos recibidos para crear appointment:', createAppointmentDto);
      
      const user = await this.userService.getUserById(req.user.id);
      
      // Si no se especifica createdById/createdByType, usar el usuario autenticado
      if (!createAppointmentDto.createdById && !createAppointmentDto.createdByType) {
        createAppointmentDto.createdById = user.id;
        createAppointmentDto.createdByType = 'user';
      }
      
      // Determinar el creador basado en el tipo
      let creator: any = user;
      if (createAppointmentDto.createdByType === 'dependent') {
        // Obtener el dependiente real por ID
        creator = await this.familyGroupsService.getDependentById(createAppointmentDto.createdById);
        if (!creator) {
          throw new HttpException(
            {
              message: 'Dependiente no encontrado',
              status: 'error',
            },
            HttpStatus.NOT_FOUND,
          );
        }
      }
      
      let appointment: Appointment;
      if (createAppointmentDto.myProfessional) {
        const myProfessional: Professionals =
          await this.professionalsService.getMyProfessionalById(
            createAppointmentDto.myProfessional.id,
          );
        appointment =
          await this.appoinmentsService.createAppointmentWithMyProfessional(
            createAppointmentDto,
            creator,
            myProfessional,
            Number(req.user.id),
          );
      } else {
        const professional: ProfessionalUser =
          await this.professionalsService.getProfessionalById(
            createAppointmentDto.professional.id,
          );
        appointment =
          await this.appoinmentsService.createAppointmentWithProfessionalUser(
            createAppointmentDto,
            creator,
            professional,
            Number(req.user.id),
          );
      }
      
      const appt = {
        id: appointment.id,
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

  @Put('/:id')
  async editAppointment(
    @Request() req,
    @Body() editAppointmentDto: EditAppointmentDto,
  ) {
    try {
      if (editAppointmentDto.myProfessional) {
        const myProfessional: Professionals =
          await this.professionalsService.getMyProfessionalById(
            editAppointmentDto.myProfessional.id,
          );
        editAppointmentDto.myProfessional = myProfessional;
        await this.appoinmentsService.updateAppointmentWithMyProfessional(
          req.params.id,
          editAppointmentDto,
        );
      } else {
        const professional: ProfessionalUser =
          await this.professionalsService.getProfessionalById(
            editAppointmentDto.professional.id,
          );
        editAppointmentDto.professional = professional;
        await this.appoinmentsService.updateAppointmentWithProfessionalUser(
          req.params.id,
          editAppointmentDto,
        );
      }
      return { status: HttpStatus.CREATED };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo editar el turno',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
