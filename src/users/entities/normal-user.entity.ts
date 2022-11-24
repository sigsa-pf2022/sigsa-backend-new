import { FamilyGroup } from '../../family-groups/entities/family-group.entity';
import { ChildEntity, ManyToMany } from 'typeorm';
import { User } from './user.entity';

@ChildEntity()
export class NormalUser extends User {

  @ManyToMany(() => FamilyGroup, (familyGroup) => familyGroup.members, {
    nullable: true,
    cascade: ['insert', 'update'],
  })
  memberFamilyGroups: FamilyGroup[];
}
