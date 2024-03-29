import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Put,
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
  async getProfessionals(@Req() request) {
    return await this.professionalsService.getProfessionals(request.user.id);
  }
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
  @Get('/specializations/:id')
  async getProfessionalsSpecializationById(@Req() request) {
    return await this.professionalsService.getProfessionalsSpecializationById(
      request.params.id,
    );
  }

  // From Dashboard
  // @UseGuards(RoleGuard(Role.Admin))
  @UsePipes(ValidationPipe)
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

  @Put('/specializations/:id')
  async updateSpecialization(@Req() request, @Body() body) {
    return this.professionalsService.updateSpecialization(
      request.params.id,
      body,
    );
  }

  @Put('/specializations/recover/:id')
  async recoverSpecialization(@Req() request) {
    return this.professionalsService.toggleStatusSpecialization(
      request.params.id,
      false,
    );
  }

  @Delete('/specializations/:id')
  async deleteSpecialization(@Req() request) {
    return this.professionalsService.toggleStatusSpecialization(
      request.params.id,
      true,
    );
  }

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
