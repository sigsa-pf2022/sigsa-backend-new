import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Professionals } from '../professionals/entities/my-professional.entity';
import { ProfessionalUser } from '../professionals/entities/professional-user.entity';
import { NotificationEvent } from '../events/entities/notification-event.entity';

@Entity()
export class Appointment extends NotificationEvent {
  @ManyToOne(() => Professionals, { nullable: true })
  @JoinColumn()
  myProfessional: Professionals;

  @ManyToOne(() => ProfessionalUser, { nullable: true })
  @JoinColumn()
  professional: ProfessionalUser;

  @Column()
  description: string;
}
