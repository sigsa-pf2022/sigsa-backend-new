import {
  Column,
  Entity,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FamilyGroup } from '../family-groups/entities/family-group.entity';
import { Role } from '../roles/enums/role.enum';

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column()
  gender: string;

  @Column({ type: 'datetime' })
  birthday: Date;

  @Column({ unique: true })
  dni: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({
    nullable: true,
    unique: true,
  })
  username: number;

  @Column({
    name: 'verification_code',
    nullable: true,
    unique: true,
  })
  verificationCode: number;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @ManyToMany(() => FamilyGroup, (familyGroup) => familyGroup.members, {
    nullable: true,
    cascade: ['insert', 'update'],
  })
  memberFamilyGroups: FamilyGroup[];

  @Column({
    type: 'enum',
    enum: Role,
    default: Role.User,
  })
  role: Role;
}
