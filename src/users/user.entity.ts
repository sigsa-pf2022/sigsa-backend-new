import {
  Column,
  Entity,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FamilyGroup } from 'src/family-groups/entities/family-group.entity';

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

  @OneToMany(() => FamilyGroup, (familyGroup) => familyGroup.createdBy, {
    nullable: true,
    cascade: ['insert', 'update'],
  })
  ownedFamilyGroups: FamilyGroup[];

  @ManyToMany(() => FamilyGroup, (familyGroup) => familyGroup.members, {
    nullable: true,
    cascade: ['insert', 'update'],
  })
  memberFamilyGroups: FamilyGroup[];
}
