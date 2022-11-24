import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailModule } from 'src/mail/mail.module';
import { User } from './entities/user.entity';
import { NormalUser } from './entities/normal-user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, NormalUser]), MailModule],
  providers: [UsersService],
  exports: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
