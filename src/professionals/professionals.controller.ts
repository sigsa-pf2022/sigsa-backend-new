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
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  eachMonthOfInterval,
  getMonth,
  isSameMonth,
  subMonths,
} from 'date-fns';
import { MailService } from 'src/mail/mail.service';
import { Role } from 'src/roles/enums/role.enum';
import RoleGuard from 'src/roles/guards/role.guards';
import { UsersService } from 'src/users/users.service';
import { CreatePatientProfessionalDto } from './dto/create-patient-professional.dto';
import { CreateProfessionalNoteDto } from './dto/create-professional-note.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { CreateProfessionalSpecializationDto } from './dto/create-professional-specialization.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { Professionals } from './entities/my-professional.entity';
import { ProfessionalUser } from './entities/professional-user.entity';
import { ProfessionalsService } from './professionals.service';

@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly userService: UsersService,
    private readonly mailService: MailService,
  ) {}

  @UseGuards(RoleGuard([Role.User]))
  @Post('/create-my-professional')
  async createMyProfessional(
    @Body() createProfessionalDto: CreateProfessionalDto,
    @Req() request,
  ) {
    try {
      const user = await this.userService.getUserById(request.user.id);
      const newMyProfessional: Professionals =
        await this.professionalsService.createMyProfessional(
          createProfessionalDto,
          user,
        );
      return { status: HttpStatus.CREATED, id: newMyProfessional.id };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el profesional',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('')
  async createProfessional(
    @Body() createProfessionalDto: CreateProfessionalDto,
  ) {
    try {
      const newProfessional: ProfessionalUser =
        await this.professionalsService.createProfessional(
          createProfessionalDto,
        );
      this.mailService.sendUserConfirmation(newProfessional);
      return { status: HttpStatus.CREATED, id: newProfessional.id };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el profesional',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
  @UseGuards(RoleGuard([Role.User]))
  @Get('/my-professionals')
  async getFamilyGroupsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const professionals =
      await this.professionalsService.getMyProfessionalsByUser(user);
    return professionals;
  }

  // @UseGuards(RoleGuard(Role.Admin))
  @UseGuards(RoleGuard([Role.User]))
  @Get('')
  async getProfessionals(
    @Req() request,
    @Query('search') search?: string,
    @Query('specializationId') specializationId?: string,
    @Query('dependentId') dependentId?: string,
    @Query('page') page?: string,
    @Query('take') take?: string,
  ) {
    const userId = request.user.id;
    const depId = Number(dependentId) > 0 ? Number(dependentId) : null;
    if (depId) {
      await this.professionalsService.assertBelongsToDependentGroup(userId, depId);
    }
    return this.professionalsService.searchProfessionals({
      userId,
      patient: depId
        ? { id: depId, type: 'dependent' }
        : { id: userId, type: 'user' },
      search,
      specializationId: Number(specializationId) > 0 ? Number(specializationId) : undefined,
      page,
      take,
    });
  }
  @UseGuards(RoleGuard([Role.Admin]))
  @Get('dashboard')
  async getProfessionalsDashboard(@Req() request) {
    console.log('profesionales');
    const res = await this.professionalsService.getProfessionalsDashboard(
      request.query.page,
      request.query.take,
      request.query.firstName,
      request.query.lastName,
    );
    return { data: res[0], total: res[1], count: res[0].length };
  }
  @UseGuards(RoleGuard([Role.Admin]))
  @Get('specializations')
  async getProfessionalsSpecializations(@Req() request) {
    const res = await this.professionalsService.getProfessionalsSpecializations(
      request.query.page,
      request.query.take,
      request.query.deleted,
      request.query.name,
      request.query.description,
    );
    return { data: res[0], total: res[1], count: res[0].length };
  }
  @Get('/specializations/all')
  async getAllProfessionalsSpecializations() {
    return await this.professionalsService.getAllProfessionalsSpecializations();
  }
  @UseGuards(RoleGuard([Role.Admin]))
  @Get('/specializations/:id')
  async getProfessionalsSpecializationById(@Req() request) {
    return await this.professionalsService.getProfessionalsSpecializationById(
      request.params.id,
    );
  }

  // From Dashboard
  // @UseGuards(RoleGuard(Role.Admin))
  @UsePipes(ValidationPipe)
  @UseGuards(RoleGuard([Role.Admin]))
  @Post('/specializations')
  async createSpecialization(
    @Req() request,
    @Body()
    createProfessionalSpecializationDto: CreateProfessionalSpecializationDto,
  ) {
    const isExist =
      await this.professionalsService.getProfessionalsSpecializationByName(
        createProfessionalSpecializationDto.name,
      );
    if (Boolean(isExist)) {
      throw new HttpException(
        {
          message: 'Ya existe una especializacion con ese nombre',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.professionalsService.createSpecialization(
      createProfessionalSpecializationDto,
    );
  }

  @UseGuards(RoleGuard([Role.Admin]))
  @Put('/specializations/:id')
  async updateSpecialization(@Req() request, @Body() body) {
    return this.professionalsService.updateSpecialization(
      request.params.id,
      body,
    );
  }

  @UseGuards(RoleGuard([Role.Admin]))
  @Put('/specializations/recover/:id')
  async recoverSpecialization(@Req() request) {
    return this.professionalsService.toggleStatusSpecialization(
      request.params.id,
      false,
    );
  }

  @UseGuards(RoleGuard([Role.Admin]))
  @Delete('/specializations/:id')
  async deleteSpecialization(@Req() request) {
    return this.professionalsService.toggleStatusSpecialization(
      request.params.id,
      true,
    );
  }

  // ---- Patient-Professional endpoints ----

  @UseGuards(RoleGuard([Role.Professional]))
  @UsePipes(ValidationPipe)
  @Post('/patients')
  async linkPatient(
    @Body() dto: CreatePatientProfessionalDto,
    @Req() request,
  ) {
    try {
      const link = await this.professionalsService.linkPatient(
        request.user.id,
        dto,
      );
      return { status: HttpStatus.CREATED, id: link.id };
    } catch (error) {
      throw new HttpException(
        { message: error.message || 'No se pudo vincular al paciente', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Delete('/patients/:patientId')
  async unlinkPatient(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('patientType') patientType: string,
    @Req() request,
  ) {
    try {
      await this.professionalsService.unlinkPatient(
        request.user.id,
        patientId,
        patientType,
      );
      return { status: HttpStatus.OK, message: 'Paciente desvinculado' };
    } catch (error) {
      throw new HttpException(
        { message: error.message || 'No se pudo desvincular al paciente', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Get('/patients')
  async getPatients(@Req() request) {
    return this.professionalsService.getPatients(request.user.id);
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Get('/agenda')
  async getAgenda(
    @Req() request,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.professionalsService.getAgenda(request.user.id, from, to);
  }

  /** Lado paciente: indicaciones recibidas (propias o de un dependiente). */
  @UseGuards(JwtAuthGuard)
  @Get('/notes/received')
  async getReceivedNotes(
    @Req() request,
    @Query('dependentId') dependentId?: string,
  ) {
    const depId = Number(dependentId) > 0 ? Number(dependentId) : undefined;
    return this.professionalsService.getReceivedNotes(request.user.id, depId);
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Get('/patients/:patientId/summary')
  async getPatientSummary(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('patientType') patientType: string,
    @Req() request,
  ) {
    return this.professionalsService.getPatientSummary(
      request.user.id,
      patientId,
      patientType,
    );
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Get('/patients/:patientId/notes')
  async getPatientNotes(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('patientType') patientType: string,
    @Req() request,
  ) {
    return this.professionalsService.getPatientNotes(
      request.user.id,
      patientId,
      patientType,
    );
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Post('/patients/:patientId/notes')
  async createPatientNote(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('patientType') patientType: string,
    @Body(new ValidationPipe({ whitelist: true, transform: true }))
    dto: CreateProfessionalNoteDto,
    @Req() request,
  ) {
    const note = await this.professionalsService.createPatientNote(
      request.user.id,
      patientId,
      patientType,
      dto.content,
    );
    return { status: HttpStatus.CREATED, note };
  }

  @UseGuards(RoleGuard([Role.Professional]))
  @Get('/patients/:patientId/documents')
  async getPatientDocuments(
    @Param('patientId', ParseIntPipe) patientId: number,
    @Query('patientType') patientType: string,
    @Req() request,
  ) {
    try {
      return await this.professionalsService.getPatientDocuments(
        request.user.id,
        patientId,
        patientType,
      );
    } catch (error) {
      throw new HttpException(
        { message: error.message || 'No se pudieron obtener los documentos', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @UseGuards(RoleGuard([Role.Admin]))
  @Get('/monthly-quantity')
  async getMonthlyUserQuantity() {
    const today = new Date();
    const professionals =
      await this.professionalsService.getMonthlyProfessionalsQuantity();
    const months = eachMonthOfInterval({
      start: subMonths(today, 5),
      end: today,
    });
    const professionalsPerMonth = [];
    for (const month of months) {
      professionalsPerMonth.push(
        professionals.filter((p) => isSameMonth(month, p.createdAt)).length,
      );
    }
    return professionalsPerMonth;
  }
}
