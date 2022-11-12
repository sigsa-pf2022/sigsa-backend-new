import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';
import { CreateMyProfessionalDto } from './dto/create-my-professional.dto';
import { CreateProfessionalSpecializationDto } from './dto/create-professional-specialization.dto';
import { Professionals } from './entities/my-professional.entity';
import { ProfessionalSpecialization } from './entities/professional-specialization.entity';
import { ProfessionalUser } from './entities/professional-user.entity';

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
  async getProfessionals() {
    return this.professionalUserRepository.find();
  }
  async getProfessionalsSpecializations(page) {
    return this.professionalSpecializationsRepository.findAndCount({
      take: 3,
      skip: page * 3,
      order: {name: 'ASC'}
    });
  }
  async getProfessionalsSpecializationById(id: number) {
    return this.professionalSpecializationsRepository.findOneBy({ id });
  }
  async getProfessionalsSpecializationByName(name: string) {
    return this.professionalSpecializationsRepository.findOneBy({ name });
  }
  async createProfessional() {}
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
  async deleteSpecialization(id: number) {
    return this.professionalSpecializationsRepository.update(
      { id },
      {
        deleted: true,
      },
    );
  }
}
