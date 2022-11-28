import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { CreateMedEventDto } from './dto/create-med-event.dto';
import { MedEvent } from './med-event.entity';
import { MedsEventService } from './meds-event.service';

@UseGuards(JwtAuthGuard)
@Controller('meds-event')
export class MedsEventController {
  constructor(
    private medsEventService: MedsEventService,
    private userService: UsersService,
  ) {}
  @Get()
  async getMedsEventsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    return await this.medsEventService.getMedsEventsByUser(user);
  }
  @Post('')
  async createMedEvent(
    @Req() req,
    @Body() createMedEventDto: CreateMedEventDto,
  ) {
    try {
      const user = await this.userService.getUserById(req.user.id);
      const medEvent: MedEvent = await this.medsEventService.createMedEvent(
        user,
        createMedEventDto,
      );

      return { status: HttpStatus.CREATED, medEvent };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el recordatorio',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
