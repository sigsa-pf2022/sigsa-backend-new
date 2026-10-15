import { User } from '../../users/entities/user.entity';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Dependent } from './dependent.entity';

@Entity({ name: 'family_group' })
export class FamilyGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: '255' })
  name: string;

  @OneToOne(() => Dependent)
  @JoinColumn()
  dependent: Dependent;

  @ManyToOne(() => User)
  @JoinColumn()
  createdBy: User;

  @ManyToMany(() => User, { nullable: true })
  @JoinTable()
  members: User[];

  /** Foto del grupo como data URI. Mismo criterio que `User.photo`. */
  @Column({ type: 'text', nullable: true })
  photo: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
