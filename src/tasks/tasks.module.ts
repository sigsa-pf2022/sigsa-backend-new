import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TasksService } from './tasks.service';
import { AppointmentsModule } from 'src/appointments/appointments.module';

@Module({
  imports: [ScheduleModule.forRoot(), AppointmentsModule],
  providers: [TasksService],
})
export class TasksModule {}