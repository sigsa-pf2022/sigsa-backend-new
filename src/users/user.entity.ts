import { FamilyGroup } from '../family-groups/entities/family-group.entity';
import { Column, Entity, ManyToMany } from 'typeorm';
import { Role } from '../roles/enums/role.enum';
import { IUser } from './abstract/IUser.abstract.entity';

@Entity({ name: 'users' })
export class User extends IUser {

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
