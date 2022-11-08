import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { State } from './state.entity';

@Entity({ name: 'cities' })
export class City {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToOne(() => State)
  state: State;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
