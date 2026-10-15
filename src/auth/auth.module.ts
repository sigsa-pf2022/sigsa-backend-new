import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from 'src/users/users.module';
import { AuthService } from './auth.service';
import { LocalStrategy } from './utils/local.strategy';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { DEFAULT_EXPIRES_IN, resolveJwtSecret } from './constants/jwt.constant';
import { JwtStrategy } from './utils/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    // registerAsync y no register: el secreto se lee cuando Nest arma el
    // módulo, ya con el .env cargado.
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: resolveJwtSecret(config.get<string>('JWT_SECRET')),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') || DEFAULT_EXPIRES_IN,
        },
      }),
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
