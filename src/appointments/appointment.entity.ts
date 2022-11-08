import { Professional } from '../professionals/professional.entity';
import { User } from '../users/user.entity';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'appointments' })
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Professional, (professional) => professional.appointments)
  @JoinColumn()
  doctor: Professional;

  @Column({ type: 'datetime' })
  date: Date;

  @Column()
  description: string;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @Column({ default: () => "'created'" })
  status: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
