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
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { MailService } from 'src/mail/mail.service';
import { Role } from 'src/roles/enums/role.enum';
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
    try {
      const existsUser = await this.userService.getUserByEmail(
        createUserDto.email,
      );
      if (existsUser) {
        throw new HttpException('Email invalido', HttpStatus.BAD_REQUEST);
      }
      const user = await this.userService.createUser(createUserDto);
      this.mailService.sendUserConfirmation(user);
      return {
        status: HttpStatus.CREATED,
        message: 'Usuario creado correctamente',
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

  @Get('/status')
  getUserStatus(@Request() req) {
    return this.userService.getUserStatus(req.params.email);
  }

  @UseGuards(JwtAuthGuard)
  @Get('/:username')
  getUserByUsername(@Request() req) {
    return this.userService.getUserByUsername(Number(req.params.username));
  }
}
