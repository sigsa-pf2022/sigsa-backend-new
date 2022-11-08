import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Appointment } from '../appointments/appointment.entity';

@Entity({ name: 'professionals' })
export class Professional {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({name: 'first_name'})
  firstName: string;

  @Column({name: 'last_name'})
  lastName: string;

  @Column()
  field: string;

  @Column()
  clinic: string;

  @Column({ name: 'street_name' })
  streetName: string;

  @Column({ name: 'street_number' })
  streetNumber: number;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @OneToMany(() => Appointment, (appointment) => appointment.doctor, {
    nullable: true,
    cascade: ['insert', 'update'],
  })
  appointments: Appointment[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}