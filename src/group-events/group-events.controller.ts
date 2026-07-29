import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { RespondNotificationDto } from './dto/respond-notification.dto';
import { GroupEventTargetType } from './enums/group-event-action.enum';
import { GroupEventsService } from './group-events.service';

@UseGuards(JwtAuthGuard)
@Controller('group-events')
export class GroupEventsController {
  constructor(private readonly groupEventsService: GroupEventsService) {}

  /** "Me hago cargo" / "Descartar" sobre una notificación del grupo. */
  @Post('notifications/:id/respond')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async respond(
    @Param('id', ParseIntPipe) notificationId: number,
    @Req() req,
    @Body() dto: RespondNotificationDto,
  ) {
    return this.groupEventsService.respondToNotification(
      notificationId,
      Number(req.user.id),
      dto.action,
    );
  }

  /**
   * Lo mismo desde adentro de la app, donde se conoce el evento pero no la
   * notificación que lo anunció.
   */
  @Post('events/:targetType/:targetId/respond')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async respondToEvent(
    @Param('targetType') targetType: string,
    @Param('targetId', ParseIntPipe) targetId: number,
    @Req() req,
    @Body() dto: RespondNotificationDto,
  ) {
    if (
      targetType !== GroupEventTargetType.MED_EVENT &&
      targetType !== GroupEventTargetType.APPOINTMENT
    ) {
      throw new BadRequestException('Tipo de evento inválido');
    }
    return this.groupEventsService.respondToEvent(
      targetType as GroupEventTargetType,
      targetId,
      Number(req.user.id),
      dto.action,
    );
  }

  /** Historial del grupo: quién hizo qué. */
  @Get(':groupId/history')
  async getHistory(
    @Param('groupId', ParseIntPipe) groupId: number,
    @Req() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.groupEventsService.getHistory(
      groupId,
      Number(req.user.id),
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }
}
