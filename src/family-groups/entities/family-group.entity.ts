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
import { User } from '../../users/user.entity';
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

  @ManyToMany(() => User, (user) => user.memberFamilyGroups, { nullable: true })
  @JoinTable()
  members: User[];

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;
}
