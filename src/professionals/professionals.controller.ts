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
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { Professional } from './professional.entity';
import { ProfessionalsService } from './professionals.service';

@UseGuards(JwtAuthGuard)
@Controller('professionals')
export class ProfessionalsController {
  constructor(
    private readonly professionalsService: ProfessionalsService,
    private readonly userService: UsersService,
  ) {}
  @Post('/create')
  async createProfeessional(
    @Body() createProfessionalDto: CreateProfessionalDto,
    @Req() request,
  ) {
    try {
      const user = await this.userService.getUserById(request.user.id);
      const newFamilyGroup: Professional =
        await this.professionalsService.createProfessional(
          createProfessionalDto,
          user,
        );
      return { status: HttpStatus.CREATED, id: newFamilyGroup.id };
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

  @Get('/my-professionals')
  async getFamilyGroupsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    const professionals =
      await this.professionalsService.getProfessionalsByUser(user);
    return professionals;
  }
}
