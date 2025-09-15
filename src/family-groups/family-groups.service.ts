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
    return await this.familyGroupRepository
      .createQueryBuilder('fg')
      .leftJoinAndSelect('fg.members', 'members')
      .leftJoinAndSelect('fg.dependent', 'dependent')
      .leftJoinAndSelect('fg.createdBy', 'createdBy')
      .innerJoin('fg.members', 'userMember', 'userMember.id = :userId', {
        userId: user.id,
      })
      .getMany();
  }

  async getFamilyGroupById(id: number) {
    return await this.familyGroupRepository.findOne({
      where: { id },
      relations: {
        dependent: true,
        members: true,
        createdBy: true,
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

    if (group.members.find((m) => m.id === newMember.id)) {
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
    try {
      const group = await this.familyGroupRepository.findOne({
        where: { id: groupId },
        relations: {
          members: true,
          createdBy: true,
          dependent: true,
        },
      });

      if (!group) {
        console.log('Grupo no encontrado');
        return false;
      }

      // Verificar que el usuario tiene acceso al grupo
      const hasAccess =
        group.createdBy.id === user.id ||
        group.members.some((member) => member.id === user.id);

      if (!hasAccess) {
        console.log('Usuario sin acceso al grupo');
        return false;
      }

      // Verificar que el miembro existe en el grupo
      const memberExists = group.members.find((member) => member.id === memberId);
      if (!memberExists) {
        console.log('El miembro no pertenece al grupo');
        return false;
      }

      // Verificar si el que abandona es el admin/creador
      const isAdminLeaving = group.createdBy.id === memberId;

      // Eliminar el miembro específico
      group.members = group.members.filter((member) => member.id !== memberId);

      if (group.members.length === 0) {
        // Si no quedan miembros, eliminar el grupo
        await this.familyGroupRepository.remove(group);
        console.log('Grupo eliminado porque no quedan miembros');
      } else if (isAdminLeaving) {
        // Si el admin abandona pero quedan miembros, delegar la administración
        const newAdmin = group.members[0]; // Tomar el primer miembro restante
        group.createdBy = newAdmin;
        await this.familyGroupRepository.save(group);
        console.log(`Administración delegada al usuario ${newAdmin.id}`);
      } else {
        // Caso normal: solo guardar sin el miembro eliminado
        await this.familyGroupRepository.save(group);
        console.log('Miembro eliminado correctamente');
      }
      return true;

    } catch (error) {
      console.error('Error en removeMemberFromGroup:', error);
      return false;
    }
  }

  async getDependentById(id: number): Promise<Dependent | null> {
    return this.dependentRepository.findOne({
      where: { id }
    });
  }
}
