import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { hashSync } from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { random } from 'src/users/utils/random-number';
import { Like, Not, Repository } from 'typeorm';
import { CreateMyProfessionalDto } from './dto/create-my-professional.dto';
import { CreateProfessionalSpecializationDto } from './dto/create-professional-specialization.dto';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { Professionals } from './entities/my-professional.entity';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { ProfessionalUser } from './entities/professional-user.entity';
import { Role } from 'src/roles/enums/role.enum';

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(ProfessionalUser)
    private professionalUserRepository: Repository<ProfessionalUser>,
    @InjectRepository(Professionals)
    private myProfessionalsRepository: Repository<Professionals>,
    @InjectRepository(ProfessionalSpecialization)
    private professionalSpecializationsRepository: Repository<ProfessionalSpecialization>,
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
    return await this.myProfessionalsRepository.findOne({
      where: { id },
    });
  }

  async getMyProfessionalsByUser(user: User) {
    return await this.myProfessionalsRepository.find({
      where: { createdBy: user },
    });
  }

  async getMyProfessionals() {
    return this.myProfessionalsRepository.find();
  }
  async getProfessionals(withoutId: number) {
    return this.professionalUserRepository.find({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        licenseNumber: true,
      },
      relations: { specialization: true },
      where: {
        id: Not(withoutId),
      }
    });
  }
  async getAllProfessionalsSpecializations() {
    return this.professionalSpecializationsRepository.find();
  }

  async getProfessionalsDashboard(
    page: number,
    quantity: number,
    firstName: string,
    lastName: string,
  ) {
    return this.professionalUserRepository.findAndCount({
      where: {
        firstName: Like(`%${firstName}%`),
        lastName: Like(`%${lastName}%`),
      },
      take: quantity,
      skip: page * quantity,
      order: { firstName: 'ASC' },
    });
  }

  async getProfessionalsSpecializations(
    page: number,
    quantity: number,
    deleted: boolean,
    name: string,
    description: string,
  ) {
    return this.professionalSpecializationsRepository.findAndCount({
      where: {
        deleted: deleted,
        name: Like(`%${name}%`),
        description: Like(`%${description}%`),
      },
      take: quantity,
      skip: page * quantity,
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
    return await this.professionalUserRepository.findOne({
      where: { id },
    });
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
      {
        name: body.name,
        description: body.description,
      },
    );
  }
  async toggleStatusSpecialization(id: number, deleted: boolean) {
    return this.professionalSpecializationsRepository.update(
      { id },
      {
        deleted,
      },
    );
  }
  getMonthlyProfessionalsQuantity() {
    return this.professionalUserRepository.find({
      select: { createdAt: true },
    });
  }
}
