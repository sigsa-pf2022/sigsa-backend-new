import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AppointmentsService } from 'src/appointments/appointments.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly appointmentsService: AppointmentsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async cancelCreatedAppointments() {
    const canceledCount = await this.appointmentsService.cancelOldCreatedAppointments();
    if (canceledCount > 0) {
      this.logger.log(`Canceladas ${canceledCount} citas creadas hace más de un día.`);
    }
  }
}