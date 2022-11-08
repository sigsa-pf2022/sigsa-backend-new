import { Module } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { UsersModule } from 'src/users/users.module';
import { ProfessionalsModule } from 'src/professionals/professionals.module';

@Module({
  imports: [
    ProfessionalsModule,
    TypeOrmModule.forFeature([Appointment]),
    UsersModule,
  ],
  providers: [AppointmentsService],
  controllers: [AppointmentsController],
})
export class AppointmentsModule {}
