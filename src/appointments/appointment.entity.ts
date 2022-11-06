import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'appointments' })
export class Appointment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  doctor: string;

  //   @Column({ type: 'datetime' })
  //   date: Date;

  @Column()
  description: string;

  @Column()
  owner: string;

  @Column({ default: () => "'created'" })
  status: string;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
