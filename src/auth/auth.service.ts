import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { compareSync } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/users/user.entity';

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
          message: 'El correo ingresado no ha sido validado',
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
            message: 'El correo ingresado no ha sido validado',
            status: 'invalid',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  async login(user: User) {
    const payload = {role: user.role, email: user.email, id: user.id };
    return {
      access_token: this.jwtService.sign(payload),
      user,
    };
  }
}
