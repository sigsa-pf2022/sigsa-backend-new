import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { compareSync } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.usersService.getUserByEmail(email);
    if (!user) {
      throw new HttpException(
        {
          message: 'Incorrecta combinación de email/contraseña',
          status: 'invalid',
        },
        HttpStatus.BAD_REQUEST,
      );
    } else {
      if (compareSync(pass, user.password)) {
        delete user.password;
        if (!user.emailVerified) {
          throw new HttpException(
            {
              message: 'El correo ingresado no ha sido validado',
              status: 'email-not-verified',
            },
            HttpStatus.BAD_REQUEST,
          );
        } else {
          return user;
        }
      } else {
        throw new HttpException(
          {
            message: 'Incorrecta combinación de email/contraseña',
            status: 'invalid',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async login(user: User) {
    const payload = { email: user.email, id: user.id, role: user['role'] };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}
