import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashSync } from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { random } from 'src/users/utils/random-number';
import { Not, Repository } from 'typeorm';
import {
  boolFilter,
  buildWhere,
  paginate,
  textFilter,
} from 'src/common/list-query';
import { CreateMyProfessionalDto } from './dto/create-my-professional.dto';
import { CreateProfessionalSpecializationDto } from './dto/create-professional-specialization.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { CreatePatientProfessionalDto } from './dto/create-patient-professional.dto';
import { Professionals } from './entities/my-professional.entity';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { ProfessionalUser } from './entities/professional-user.entity';
import { PatientProfessional } from './entities/patient-professional.entity';
import { PatientProfessionalStatus } from './enums/patient-professional-status.enum';
import { Role } from 'src/roles/enums/role.enum';
import { DocumentsService } from 'src/documents/documents.service';
import { UsersService } from 'src/users/users.service';
import { FamilyGroupsService } from 'src/family-groups/family-groups.service';
import { NotificationsService } from 'src/notifications/notifications.service';

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(ProfessionalUser)
    private professionalUserRepository: Repository<ProfessionalUser>,
    @InjectRepository(Professionals)
    private myProfessionalsRepository: Repository<Professionals>,
    @InjectRepository(ProfessionalSpecialization)
    private professionalSpecializationsRepository: Repository<ProfessionalSpecialization>,
    @InjectRepository(PatientProfessional)
    private patientProfessionalRepository: Repository<PatientProfessional>,
    private readonly documentsService: DocumentsService,
    private readonly usersService: UsersService,
    private readonly familyGroupsService: FamilyGroupsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createMyProfessional(
    createMyProfessionalDto: CreateMyProfessionalDto,
    user: User,
  ): Promise<Professionals> {
    const newProfessional = this.myProfessionalsRepository.create({
      createdBy: user,
      ...createMyProfessionalDto,
    });
    return this.myProfessionalsRepository.save(newProfessional);
  }

  async getMyProfessionalById(id: number) {
    return await this.myProfessionalsRepository.findOne({ where: { id } });
  }

  async getMyProfessionalsByUser(user: User) {
    return await this.myProfessionalsRepository.find({
      where: { createdBy: { id: user.id } },
    });
  }

  async getMyProfessionals() {
    return this.myProfessionalsRepository.find();
  }

  async getProfessionals(withoutId: number) {
    return this.professionalUserRepository.find({
      select: { id: true, firstName: true, lastName: true, licenseNumber: true },
      relations: { specialization: true },
      where: { id: Not(withoutId) },
    });
  }

  async getAllProfessionalsSpecializations() {
    return this.professionalSpecializationsRepository.find();
  }

  async getProfessionalsDashboard(
    page: number,
    quantity: number,
    firstName?: string,
    lastName?: string,
  ) {
    return this.professionalUserRepository.findAndCount({
      where: buildWhere({
        firstName: textFilter(firstName),
        lastName: textFilter(lastName),
      }),
      ...paginate(page, quantity),
      order: { firstName: 'ASC' },
    });
  }

  async getProfessionalsSpecializations(
    page: number,
    quantity: number,
    deleted: unknown,
    name?: string,
    description?: string,
  ) {
    return this.professionalSpecializationsRepository.findAndCount({
      where: buildWhere({
        deleted: boolFilter(deleted),
        name: textFilter(name),
        description: textFilter(description),
      }),
      ...paginate(page, quantity),
      order: { name: 'ASC' },
    });
  }

  async getProfessionalsSpecializationById(id: number) {
    return this.professionalSpecializationsRepository.findOneBy({ id });
  }

  async getProfessionalsSpecializationByName(name: string) {
    return this.professionalSpecializationsRepository.findOneBy({ name });
  }

  async createProfessional(
    createProfessionalDto: CreateProfessionalDto,
  ): Promise<ProfessionalUser> {
    const password = hashSync(createProfessionalDto.password, 10);
    const newProfessional = this.professionalUserRepository.create({
      ...createProfessionalDto,
      password,
    });
    newProfessional.verificationCode = random();
    newProfessional.role = Role.Professional;
    return this.professionalUserRepository.save(newProfessional);
  }

  async getProfessionalById(id: number) {
    return await this.professionalUserRepository.findOne({ where: { id } });
  }

  async createSpecialization(
    createSpecializationDto: CreateProfessionalSpecializationDto,
  ) {
    const newSpecialization = this.professionalSpecializationsRepository.create(
      createSpecializationDto,
    );
    return this.professionalSpecializationsRepository.save(newSpecialization);
  }

  async updateSpecialization(id: number, body) {
    return this.professionalSpecializationsRepository.update(
      { id },
      { name: body.name, description: body.description },
    );
  }

  async toggleStatusSpecialization(id: number, deleted: boolean) {
    return this.professionalSpecializationsRepository.update({ id }, { deleted });
  }

  getMonthlyProfessionalsQuantity() {
    return this.professionalUserRepository.find({ select: { createdAt: true } });
  }

  // ---- Patient-Professional linkage ----

  async linkPatient(
    professionalId: number,
    dto: CreatePatientProfessionalDto,
  ): Promise<PatientProfessional> {
    const existing = await this.patientProfessionalRepository.findOne({
      where: { professionalId, patientId: dto.patientId, patientType: dto.patientType },
    });
    if (existing) {
      throw new BadRequestException('El paciente ya está vinculado');
    }

    if (dto.patientType === 'dependent') {
      const dependent = await this.familyGroupsService.getDependentById(dto.patientId);
      if (!dependent) {
        throw new NotFoundException('No se encontró el dependiente');
      }

      const link = this.patientProfessionalRepository.create({
        professionalId,
        patientId: dto.patientId,
        patientType: 'dependent',
        status: PatientProfessionalStatus.PENDING,
      });
      const saved = await this.patientProfessionalRepository.save(link);

      // Notificar a todos los miembros del grupo familiar
      const group = await this.familyGroupsService.findByDependentId(dto.patientId);
      if (group) {
        const professional = await this.professionalUserRepository.findOne({
          where: { id: professionalId },
        });
        const memberIds = (group.members || []).map((m) => m.id);
        if (memberIds.length) {
          await this.notificationsService.createForProfessionalLinkRequest({
            patientProfessionalId: saved.id,
            memberUserIds: memberIds,
            payload: {
              professionalName: professional
                ? `${professional.firstName} ${professional.lastName}`
                : 'Un profesional',
              dependentName: `${dependent.firstName} ${dependent.lastName}`,
            },
          });
        }
      }

      return saved;
    }

    // patientType === 'user': vínculo directo, status ACCEPTED por defecto
    const link = this.patientProfessionalRepository.create({
      professionalId,
      patientId: dto.patientId,
      patientType: dto.patientType,
    });
    return this.patientProfessionalRepository.save(link);
  }

  async unlinkPatient(
    professionalId: number,
    patientId: number,
    patientType: string,
  ) {
    const link = await this.patientProfessionalRepository.findOne({
      where: { professionalId, patientId, patientType },
    });
    if (!link) {
      throw new NotFoundException('El vínculo no existe');
    }
    return this.patientProfessionalRepository.remove(link);
  }

  async getPatients(professionalId: number) {
    const allLinks = await this.patientProfessionalRepository.find({
      where: { professionalId },
      order: { createdAt: 'DESC' },
    });

    const enrich = async (link: PatientProfessional) => {
      let firstName = '';
      let lastName = '';
      if (link.patientType === 'user') {
        const user = await this.usersService.getUserById(link.patientId);
        if (user) { firstName = user.firstName; lastName = user.lastName; }
      } else {
        const dep = await this.familyGroupsService.getDependentById(link.patientId);
        if (dep) { firstName = dep.firstName; lastName = dep.lastName; }
      }
      return { ...link, firstName, lastName };
    };

    const accepted = await Promise.all(
      allLinks
        .filter((l) => l.status === PatientProfessionalStatus.ACCEPTED)
        .map(enrich),
    );

    const pending = await Promise.all(
      allLinks
        .filter(
          (l) =>
            l.status === PatientProfessionalStatus.PENDING &&
            l.patientType === 'dependent',
        )
        .map(enrich),
    );

    return { patients: accepted, pendingRequests: pending };
  }

  async getPatientDocuments(
    professionalId: number,
    patientId: number,
    patientType: string,
  ) {
    const link = await this.patientProfessionalRepository.findOne({
      where: { professionalId, patientId, patientType },
    });
    if (!link) {
      throw new NotFoundException('No tiene vínculo con este paciente');
    }
    if (link.status !== PatientProfessionalStatus.ACCEPTED) {
      throw new NotFoundException(
        'La vinculación aún no fue aprobada por el responsable',
      );
    }
    return this.documentsService.getDocumentsByPatient(patientId, patientType);
  }
}
