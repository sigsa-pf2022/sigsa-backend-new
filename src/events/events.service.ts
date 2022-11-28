import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEvent } from './entities/notification-event.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(NotificationEvent)
    private eventRepository: Repository<NotificationEvent>,
  ) {}

  getEvents() {
    return this.eventRepository.find();
  }
}
