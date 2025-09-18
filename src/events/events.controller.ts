import { Controller, Get, Param, ParseIntPipe, Req, UseGuards, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { EventsService } from './events.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private eventsService: EventsService,
    private usersService: UsersService,
    private familyGroupsService: FamilyGroupsService,
  ) {}

  @Get()
  async getNextEvents(@Req() req) {
    const user = await this.usersService.getUserById(req.user.id);
    return await this.eventsService.getEventsByUser(user);
  }

  @Get('dependent/:id')
  async getNextEventsByDependent(@Param('id', ParseIntPipe) dependentId: number) {
    const dependent = await this.familyGroupsService.getDependentById(dependentId);
    if (!dependent) {
      throw new NotFoundException('Dependiente no encontrado');
    }
    try {
      return await this.eventsService.getEventsByDependent(dependent);
    } catch (e) {
      console.error('EventsController:getNextEventsByDependent error', e);
      throw new InternalServerErrorException('No fue posible obtener los eventos del dependiente');
    }
  }
}
