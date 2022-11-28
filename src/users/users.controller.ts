import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import {
  eachMonthOfInterval,
  isSameMonth,
  subMonths,
} from 'date-fns';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { MailService } from 'src/mail/mail.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ValidateUserDto } from './dto/validate-user.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly mailService: MailService,
  ) {}

  @Post('/create')
  @UsePipes(ValidationPipe)
  async createUser(@Body() createUserDto: CreateUserDto) {
    const existsUser = await this.userService.getUserByEmail(
      createUserDto.email,
    );
    if (existsUser) {
      throw new HttpException('Email inválido', HttpStatus.BAD_REQUEST);
    }
    const user = await this.userService.createUser(createUserDto);
    this.mailService.sendUserConfirmation(user);
    return {
      status: HttpStatus.CREATED,
      message: 'Usuario creado correctamente',
    };
  }

  @Post('/recovery-password-email')
  async recoveryPasswordEmail(@Body() data) {
    try {
      const user = await this.userService.getUserByEmail(data.email);
      if (!user) {
        throw new HttpException('Email inválido', HttpStatus.BAD_REQUEST);
      }
      await this.userService
        .setRecoveryPasswordToken(user)
        .then(() => this.mailService.sendUserRecoveryPassword(user));
      return {
        status: HttpStatus.OK,
        message: 'Email enviado',
      };
    } catch (error) {
      return error;
    }
  }

  @Post('/reset-password')
  async resetPassword(@Body() data) {
    try {
      const user = await this.userService.getUserByEmail(data.email);
      if (!user) {
        throw new HttpException('Email inválido', HttpStatus.BAD_REQUEST);
      }
      await this.userService.resetPassword(data, user);
      return {
        status: HttpStatus.OK,
        message: 'Contraseña reestablecida correctamente',
      };
    } catch (error) {
      return error;
    }
  }

  @Post('/validate')
  @UsePipes(ValidationPipe)
  async validateUser(@Body() validateUserDto: ValidateUserDto) {
    const { user, isCodeCorrect } = await this.userService.validateUser(
      validateUserDto,
    );
    if (!isCodeCorrect) {
      throw new HttpException(
        {
          status: 'invalid-code',
          message: 'Codigo de verificacion de correo incorrecto.',
        },
        HttpStatus.BAD_REQUEST,
      );
    } else {
      this.userService.updateValidateStatus(user.id);
      return { status: HttpStatus.OK, message: 'Codigo correcto' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('')
  getUser(@Request() req) {
    return this.userService.getUserById(Number(req.user.id));
  }

  @Get('all')
  async getUsers() {
    return await this.userService.getUsers();
  }

  @Get('/status')
  async getUserStatus(@Request() req) {
    console.log(req.query)
    const user = await this.userService.getUserStatus(req.query.email);
    if (!user) {
      throw new HttpException(
      {
        message: 'Incorrecta combinación de email/contraseña',
        status: 'invalid',
      },
      HttpStatus.BAD_REQUEST,
      );
    }
    return user.emailVerified;
  }

  @Get('/monthly-quantity')
  async getMonthlyUserQuantity() {
    const today = new Date();
    const users = await this.userService.getMonthlyUserQuantity();
    const months = eachMonthOfInterval({
      start: subMonths(today, 5),
      end: today,
    });
    const userPerMonth = [];
    for (const month of months) {
      userPerMonth.push(
        users.filter((u) => isSameMonth(month, u.createdAt)).length,
      );
    }
    return userPerMonth;
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:dni')
  getUserByDni(@Request() req) {
    return this.userService.getUserByDni(req.params.dni);
  }
}
