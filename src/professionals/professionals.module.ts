import { Module } from '@nestjs/common';
import { ProfessionalsService } from './professionals.service';
import { ProfessionalsController } from './professionals.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessionalUser } from './entities/professional-user.entity';
import { UsersModule } from 'src/users/users.module';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { Professionals } from './entities/my-professional.entity';
import { MailModule } from 'src/mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProfessionalUser,
      ProfessionalSpecialization,
      Professionals,
    ]),
    UsersModule,
    MailModule,
  ],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
  controllers: [ProfessionalsController],
})
export class ProfessionalsModule {}
