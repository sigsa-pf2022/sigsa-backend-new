import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from 'src/roles/enums/role.enum';
import RoleGuard from 'src/roles/guards/role.guards';
import { UsersService } from 'src/users/users.service';
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
        HttpStatus.BAD_REQUEST,
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

  @UseGuards(RoleGuard(Role.Admin))
  @UseGuards(RoleGuard(Role.User))
  @Get('')
  getProfessionals() {}

  @Post('/create')
  createProfessional(@Body() createProfessionalDto) {
    console.log(createProfessionalDto);
  }

  // From Dashboard
  @UseGuards(RoleGuard(Role.Admin))
  @Post('/title')
  createTitle(@Req() request, @Body() body) {}
}
