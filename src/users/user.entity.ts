import { Column, Entity, ManyToMany } from 'typeorm';
import { FamilyGroup } from '../family-groups/entities/family-group.entity';
import { Role } from '../roles/enums/role.enum';
import { IUser } from './abstract/IUser.abstract.entity';

@Entity({ name: 'users' })
export class User extends IUser {
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
  
  @Column({
    name: 'recovery_password_token',
    nullable: true,
    unique: true,
  })
  recoveryPasswordToken: number;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

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
