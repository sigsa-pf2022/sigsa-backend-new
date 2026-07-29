import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { UsersService } from 'src/users/users.service';
import { CreateMedEventDto } from './dto/create-med-event.dto';
import { MedEvent } from './med-event.entity';
import { MedsEventService } from './meds-event.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';

@UseGuards(JwtAuthGuard)
@Controller('meds-event')
export class MedsEventController {
  constructor(
    private medsEventService: MedsEventService,
    private userService: UsersService,
    private familyGroupsService: FamilyGroupsService,
  ) {}
  @Get()
  async getMedsEventsByUserId(@Req() request) {
    const user = await this.userService.getUserById(request.user.id);
    return await this.medsEventService.getMedsEventsByUser(user);
  }

  @Get('dependent/:id')
  async getMedsEventsByDependentId(@Param('id', ParseIntPipe) dependentId: number) {
    const dependent = await this.familyGroupsService.getDependentById(dependentId);
    if (!dependent) {
      throw new HttpException(
        {
          message: 'Dependiente no encontrado',
          status: 'error',
        },
        HttpStatus.NOT_FOUND,
      );
    }
    
    return await this.medsEventService.getMedsEventsByDependent(dependent);
  }
  @Post('')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
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

  @Get(':id')
  async getMedEventById(@Param('id', ParseIntPipe) id: number) {
    const medEvent = await this.medsEventService.getMedEventById(id);
    if (!medEvent) {
      throw new HttpException(
        { message: 'Recordatorio no encontrado', status: 'error' },
        HttpStatus.NOT_FOUND,
      );
    }
    return medEvent;
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async updateMedEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateData: Partial<CreateMedEventDto>,
  ) {
    await this.medsEventService.updateMedEvent(id, updateData);
    return { status: HttpStatus.OK };
  }

  @Patch(':id/cancel')
  async cancelMedEvent(@Param('id', ParseIntPipe) id: number) {
    await this.medsEventService.cancelMedEvent(id);
    return { status: HttpStatus.OK };
  }

  @Patch(':id/confirm')
  async confirmMedEvent(@Param('id', ParseIntPipe) id: number) {
    await this.medsEventService.confirmMedEvent(id);
    return { status: HttpStatus.OK };
  }

  @Post('dependent/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createMedEventForDependent(
    @Param('id', ParseIntPipe) dependentId: number,
    @Req() req,
    @Body() createMedEventDto: CreateMedEventDto,
  ) {
    try {
      const dependent = await this.familyGroupsService.getDependentById(dependentId);
      if (!dependent) {
        throw new HttpException(
          { message: 'Dependiente no encontrado', status: 'error' },
          HttpStatus.NOT_FOUND,
        );
      }
      const medEvent: MedEvent = await this.medsEventService.createMedEvent(
        dependent,
        createMedEventDto,
        Number(req.user.id),
      );
      return { status: HttpStatus.CREATED, medEvent };
    } catch (error) {
      throw new HttpException(
        {
          message: 'No se pudo crear el recordatorio para dependiente',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
