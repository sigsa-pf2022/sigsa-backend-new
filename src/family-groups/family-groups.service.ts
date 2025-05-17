import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { Dependent } from './entities/dependent.entity';
import { FamilyGroup } from './entities/family-group.entity';
import { UsersService } from 'src/users/users.service';
@Injectable()
export class FamilyGroupsService {
  constructor(
    @InjectRepository(FamilyGroup)
    private familyGroupRepository: Repository<FamilyGroup>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    private readonly userService: UsersService,
  ) {}

  async createGroup(
    name: string,
    createDependentDto: CreateDependentDto,
    user: User,
    members: User[],
  ) {
    const newDependent = await this.createDependent(createDependentDto);
    const newFamilyGroup = this.familyGroupRepository.create({
      name,
      dependent: newDependent,
      createdBy: user,
      members,
    });
    return this.familyGroupRepository.save(newFamilyGroup);
  }

  createDependent(createDependentDto: CreateDependentDto) {
    const newDependent = this.dependentRepository.create(createDependentDto);
    return this.dependentRepository.save(newDependent);
  }

  async getFamilyGroupsByUser(user: User) {
    return await this.familyGroupRepository.find({
      where: [{ members: { id: user.id } }],
      relations: {
        members: true,
        dependent: true,
      },
    });
  }

  async getFamilyGroupById(id: number) {
    return await this.familyGroupRepository.findOne({
      where: { id },
      relations: {
        dependent: true,
        members: true,
      },
    });
  }

  async addMemberToGroup(
    groupId: number,
    member: any,
    user: User,
  ): Promise<boolean> {
    const group = await this.familyGroupRepository.findOne({
      where: [
        { id: groupId, createdBy: { id: user.id } },
        { id: groupId, members: { id: user.id } },
      ],
      relations: {
        members: true,
        createdBy: true,
        dependent: true,
      },
    });

    if (!group) {
      console.log('Grupo no encontrado o usuario sin acceso');
      return false;
    }

    let newMember = null;
    if (member.dni) {
      newMember = await this.userService.getFullUserByDni(member.dni);
    } else if (member.id) {
      newMember = await this.userService.getUserById(member.id);
    }

    if (!newMember) {
      console.log('Miembro no encontrado');
      return false;
    }

    if (group.members.find(m => m.id === newMember.id)) {
      console.log('El miembro ya pertenece al grupo');
      return false;
    }

    group.members.push(newMember);
    await this.familyGroupRepository.save(group);
    return true;
  }

  async removeMemberFromGroup(
    groupId: number,
    memberId: number,
    user: User,
  ): Promise<boolean> {
    const group = await this.familyGroupRepository.findOne({
      where: [
        { id: groupId, createdBy: { id: user.id } },
        { id: groupId, members: { id: user.id } },
      ],
      relations: {
        members: true,
        dependent: true,
        createdBy: true,
      },
    });

    if (!group) {
      return false;
    }

    const originalLength = group.members.length;
    group.members = group.members.filter((member) => member.id !== memberId);

    if (group.members.length === originalLength) {
      return false;
    }

    if (group.members.length === 0) {
      await this.familyGroupRepository.remove(group);
    } else {
      await this.familyGroupRepository.save(group);
    }

    return true;
  }
}
