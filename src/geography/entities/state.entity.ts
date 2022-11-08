import { Column, Entity, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Country } from './country.entity';

@Entity({ name: 'states' })
export class State {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @OneToOne(() => Country)
  country: Country;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
