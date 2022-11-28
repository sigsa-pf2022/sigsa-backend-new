import { NotificationEvent } from 'src/events/entities/notification-event.entity';
import { Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Meds } from '../meds/meds.entity';

@Entity()
export class MedEvent extends NotificationEvent {
  @ManyToOne(() => Meds, { nullable: true })
  @JoinColumn()
  med: Meds;
}
