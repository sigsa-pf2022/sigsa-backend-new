import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Appointment } from 'src/appointments/appointment.entity';
import { AppointmentsService } from 'src/appointments/appointments.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private appointmentsService: AppointmentsService,
    private usersService: UsersService,
  ) {}
  @Get()
  async getNextEvents(@Req() req) {
    const user = await this.usersService.getUserById(req.user.id);
    const res: Appointment[] =
      await this.appointmentsService.getNextAppointmentsByUser(user);
    const appointments = res.map((a) => {
      return {
        professional: a.myProfessional ? a.myProfessional : a.professional,
        date: a.date,
        id: a.id,
      };
    });
    return appointments;
  }
}
