import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { Event } from 'src/events/entities/event.entity';
import { User } from 'src/users/user.entity';
import { Professionals } from 'src/professionals/entities/my-professional.entity';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';

@Entity()
export class Appointment extends Event {
  @ManyToOne(() => Professionals, { nullable: true })
  @JoinColumn()
  myProfessional: Professionals;

  @ManyToOne(() => ProfessionalUser, { nullable: true })
  @JoinColumn()
  professional: ProfessionalUser;

  @Column()
  description: string;
}
