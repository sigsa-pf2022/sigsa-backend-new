import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/entities/user.entity';
import { In, Repository } from 'typeorm';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { Dependent } from './entities/dependent.entity';
import { FamilyGroup } from './entities/family-group.entity';
import { UsersService } from 'src/users/users.service';
import { PatientProfessional } from 'src/professionals/entities/patient-professional.entity';
import { PatientProfessionalStatus } from 'src/professionals/enums/patient-professional-status.enum';
import { ProfessionalUser } from 'src/professionals/entities/professional-user.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { GroupEventsService } from 'src/group-events/group-events.service';
import { GroupEventAction, GroupEventTargetType } from 'src/group-events/enums/group-event-action.enum';
import { titleCase } from 'src/notifications/utils/title-case';

@Injectable()
export class FamilyGroupsService {
  constructor(
    @InjectRepository(FamilyGroup)
    private familyGroupRepository: Repository<FamilyGroup>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
    @InjectRepository(PatientProfessional)
    private patientProfessionalRepository: Repository<PatientProfessional>,
    @InjectRepository(ProfessionalUser)
    private professionalUserRepository: Repository<ProfessionalUser>,
    private readonly userService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly groupEventsService: GroupEventsService,
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

    await this.groupEventsService.log({
      groupId: group.id,
      actorUserId: user.id,
      action: GroupEventAction.MEMBER_ADDED,
      targetType: GroupEventTargetType.MEMBER,
      targetId: newMember.id,
      payload: { memberName: `${newMember.firstName} ${newMember.lastName}`.trim() },
    });

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

      const hasAccess =
        group.createdBy.id === user.id ||
        group.members.some((member) => member.id === user.id);

      if (!hasAccess) {
        console.log('Usuario sin acceso al grupo');
        return false;
      }

      const memberExists = group.members.find((member) => member.id === memberId);
      if (!memberExists) {
        console.log('El miembro no pertenece al grupo');
        return false;
      }

      const isAdminLeaving = group.createdBy.id === memberId;

      group.members = group.members.filter((member) => member.id !== memberId);

      // Se registra antes de tocar el grupo: si queda vacío se borra, y con él
      // el historial deja de tener sentido.
      if (group.members.length > 0) {
        await this.groupEventsService.log({
          groupId: group.id,
          actorUserId: user.id,
          action: GroupEventAction.MEMBER_REMOVED,
          targetType: GroupEventTargetType.MEMBER,
          targetId: memberId,
          payload: {
            memberName: `${memberExists.firstName} ${memberExists.lastName}`.trim(),
            selfRemoved: memberId === user.id,
          },
        });
      }

      if (group.members.length === 0) {
        await this.familyGroupRepository.remove(group);
        console.log('Grupo eliminado porque no quedan miembros');
      } else if (isAdminLeaving) {
        const newAdmin = group.members[0];
        group.createdBy = newAdmin;
        await this.familyGroupRepository.save(group);
        console.log(`Administración delegada al usuario ${newAdmin.id}`);
      } else {
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
    return this.dependentRepository.findOne({ where: { id } });
  }

  async findByDependentId(dependentId: number): Promise<FamilyGroup | null> {
    return this.familyGroupRepository.findOne({
      where: { dependent: { id: dependentId } },
      relations: { members: true, createdBy: true, dependent: true },
    });
  }

  // ---- Búsqueda de dependiente por DNI ----

  /**
   * Busca dependientes por DNI y devuelve la info del grupo y del responsable.
   * Si dos grupos distintos tienen dependientes con el mismo DNI (caso raro),
   * se devuelven todos los matches. El profesional elige el correcto.
   */
  async getDependentByDni(dni: string) {
    const groups = await this.familyGroupRepository
      .createQueryBuilder('fg')
      .leftJoinAndSelect('fg.dependent', 'dep')
      .leftJoinAndSelect('fg.createdBy', 'admin')
      .where('dep.dni = :dni', { dni })
      .getMany();

    return groups.map((g) => ({
      dependentId: g.dependent.id,
      dependentFirstName: g.dependent.firstName,
      dependentLastName: g.dependent.lastName,
      dependentDni: g.dependent.dni,
      groupId: g.id,
      groupName: g.name,
      responsibleFirstName: g.createdBy.firstName,
      responsibleLastName: g.createdBy.lastName,
    }));
  }

  // ---- Gestión de solicitudes de vinculación profesional ----

  async getPendingRequestsForUser(userId: number) {
    const adminGroups = await this.familyGroupRepository.find({
      where: { createdBy: { id: userId } },
      relations: { dependent: true },
    });

    if (!adminGroups.length) return [];

    const dependentIds = adminGroups.map((g) => g.dependent.id);

    const requests = await this.patientProfessionalRepository.find({
      where: {
        patientType: 'dependent',
        status: PatientProfessionalStatus.PENDING,
        patientId: In(dependentIds),
      },
    });

    if (!requests.length) return [];

    return Promise.all(
      requests.map(async (req) => {
        const group = adminGroups.find((g) => g.dependent.id === req.patientId);
        const professional = await this.professionalUserRepository.findOne({
          where: { id: req.professionalId },
          relations: { specialization: true },
        });
        return {
          id: req.id,
          professionalId: req.professionalId,
          professionalFirstName: professional?.firstName ?? '',
          professionalLastName: professional?.lastName ?? '',
          licenseNumber: professional?.licenseNumber ?? null,
          specialization: professional?.specialization ?? [],
          dependentId: group?.dependent.id,
          dependentFirstName: group?.dependent.firstName ?? '',
          dependentLastName: group?.dependent.lastName ?? '',
          groupId: group?.id,
          groupName: group?.name ?? '',
          createdAt: req.createdAt,
        };
      }),
    );
  }

  async acceptProfessionalRequest(requestId: number, userId: number) {
    const request = await this.patientProfessionalRepository.findOne({
      where: {
        id: requestId,
        patientType: 'dependent',
        status: PatientProfessionalStatus.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada o ya resuelta');
    }

    const group = await this.familyGroupRepository.findOne({
      where: { dependent: { id: request.patientId } },
      relations: { createdBy: true, dependent: true },
    });

    if (!group || group.createdBy.id !== userId) {
      throw new ForbiddenException('No tenés permiso para resolver esta solicitud');
    }

    request.status = PatientProfessionalStatus.ACCEPTED;
    request.resolvedAt = new Date();
    await this.patientProfessionalRepository.save(request);

    await this.notificationsService.createForProfessionalLinkAccepted({
      patientProfessionalId: request.id,
      professionalUserId: request.professionalId,
      payload: {
        dependentName: `${group.dependent.firstName} ${group.dependent.lastName}`,
        message: `Tu solicitud de vinculación con ${titleCase(
          `${group.dependent.firstName} ${group.dependent.lastName}`,
        )} fue aceptada.`,
      },
    });

    const professional = await this.userService.getUserById(request.professionalId);
    await this.groupEventsService.log({
      groupId: group.id,
      actorUserId: userId,
      action: GroupEventAction.PROFESSIONAL_LINKED,
      targetType: GroupEventTargetType.MEMBER,
      targetId: request.professionalId,
      payload: {
        professionalName: professional
          ? `${professional.firstName} ${professional.lastName}`.trim()
          : 'Profesional',
        dependentName: `${group.dependent.firstName} ${group.dependent.lastName}`.trim(),
      },
    });

    return { id: request.id, status: request.status };
  }

  async rejectProfessionalRequest(requestId: number, userId: number) {
    const request = await this.patientProfessionalRepository.findOne({
      where: {
        id: requestId,
        patientType: 'dependent',
        status: PatientProfessionalStatus.PENDING,
      },
    });

    if (!request) {
      throw new NotFoundException('Solicitud no encontrada o ya resuelta');
    }

    const group = await this.familyGroupRepository.findOne({
      where: { dependent: { id: request.patientId } },
      relations: { createdBy: true },
    });

    if (!group || group.createdBy.id !== userId) {
      throw new ForbiddenException('No tenés permiso para resolver esta solicitud');
    }

    request.status = PatientProfessionalStatus.REJECTED;
    request.resolvedAt = new Date();
    await this.patientProfessionalRepository.save(request);

    return { id: request.id, status: request.status };
  }
}
