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
  ) {}

  @UseGuards(RoleGuard(Role.User))
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
            HttpStatus.INTERNAL_SERVER_ERROR,
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
      return { status: HttpStatus.CREATED, id: newProfessional.id };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el profesional',
          status: 'error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @UseGuards(RoleGuard(Role.User))
  @Get('/my-professionals')
  async getFamilyGroupsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const professionals =
      await this.professionalsService.getMyProfessionalsByUser(user);
    return professionals;
  }

  // @UseGuards(RoleGuard(Role.Admin))
  // @UseGuards(RoleGuard(Role.User))
  @Get('')
  async getProfessionals() {
    return await this.professionalsService.getProfessionals();
  }
  @Get('specializations')
  async getProfessionalsSpecializations(@Req() request) {
    const res = await this.professionalsService.getProfessionalsSpecializations(
      request.query.page,
      request.query.take,
    );
    return { data: res[0], count: res[1] };
  }
  @Get('/specializations/all')
  async getAllProfessionalsSpecializations() {
    return await this.professionalsService.getAllProfessionalsSpecializations()
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

  @Delete('/specializations/:id')
  async deleteSpecialization(@Req() request) {
    return this.professionalsService.deleteSpecialization(request.params.id);
  }
}
