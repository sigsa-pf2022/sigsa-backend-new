import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { EventsService } from './events.service';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private eventsService: EventsService,
    private usersService: UsersService,
  ) {}

  @Get()
  async getNextEvents(@Req() req) {
    const user = await this.usersService.getUserById(req.user.id);
    return await this.eventsService.getEventsByUser(user);
  }
}
