import {
  Body,
  Controller,
  Get,
  Patch,
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
import { UpdateUserDto } from './dto/update-user.dto';
import { ValidateUserDto } from './dto/validate-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UsersService } from './users.service';
import { Role } from 'src/roles/enums/role.enum';
import RoleGuard from 'src/roles/guards/role.guards';

@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UsersService,
    private readonly mailService: MailService,
  ) {}

  @Post('/create')
  @UsePipes(ValidationPipe)
  async createUser(@Body() createUserDto: CreateUserDto) {
    console.log('createUserDto',createUserDto)
    const existsUser = await this.userService.existingUser(
      createUserDto.email,
      createUserDto.dni
    );
    
    console.log('existsUser', existsUser)
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

  // Antes los dos endpoints hacían `return error` en el catch: la excepción
  // salía como cuerpo de una respuesta 201 y la app avanzaba igual.
  @Post('/recovery-password-email')
  async recoveryPasswordEmail(@Body() data) {
    const user = await this.userService.getUserByEmail(data?.email ?? '');
    if (!user) {
      throw new HttpException(
        { message: 'No existe una cuenta con ese email', status: 'error' },
        HttpStatus.NOT_FOUND,
      );
    }
    await this.userService.setRecoveryPasswordToken(user);
    await this.mailService.sendUserRecoveryPassword(user);
    return {
      status: HttpStatus.OK,
      message: 'Email enviado',
    };
  }

  @Post('/reset-password')
  @UsePipes(new ValidationPipe({ transform: true }))
  async resetPassword(@Body() data: ResetPasswordDto) {
    const user = await this.userService.getUserByEmail(data.email);
    if (
      !user ||
      user.recoveryPasswordToken == null ||
      user.recoveryPasswordToken !== Number(data.code)
    ) {
      throw new HttpException(
        { message: 'El código es inválido o ya fue usado', status: 'error' },
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.userService.resetPassword(data, user);
    return {
      status: HttpStatus.OK,
      message: 'Contraseña restablecida correctamente',
    };
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
          message: 'El código es incorrecto.',
        },
        HttpStatus.BAD_REQUEST,
      );
    } else {
      // Con await: si respondemos antes de persistir la verificación, un login
      // inmediato encuentra el usuario todavía sin verificar y lo rebota.
      await this.userService.updateValidateStatus(user.id);
      return { status: HttpStatus.OK, message: 'Codigo correcto' };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('')
  getUser(@Request() req) {
    return this.userService.getUserById(Number(req.user.id));
  }

  @UseGuards(RoleGuard([Role.Admin]))
  @Get('all')
  async getUsers(@Request() request) {
    const res = await this.userService.getUsers(
      request.query.page,
      request.query.take,
      request.query.firstName,
      request.query.lastName,
    );
    return { data: res[0], count: res[1], total: res[1] };
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

  @UseGuards(RoleGuard([Role.Admin]))
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

  /**
   * "Mis datos": el usuario edita sus propios datos básicos.
   * El id sale del token, nunca del body.
   */
  @UseGuards(JwtAuthGuard)
  @Patch('/me')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateMe(@Request() req, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.updateUser(Number(req.user.id), updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:dni')
  getUserByDni(@Request() req) {
    return this.userService.getUserByDni(req.params.dni);
  }
}
