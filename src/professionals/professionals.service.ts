import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { Professional } from './professional.entity';

@Injectable()
export class ProfessionalsService {
  constructor(
    @InjectRepository(Professional)
    private professionalRepository: Repository<Professional>,
  ) {}

  async createProfessional(
    createProfessionalDto: CreateProfessionalDto,
    user: User,
  ) {
    const newProfessional = this.professionalRepository.create({
      createdBy: user,
      ...createProfessionalDto,
    });
    return this.professionalRepository.save(newProfessional);
  }

  async getProfessionalById(id: number) {
    return await this.professionalRepository.findOne({
      where: { id },
    });
  }

  async getProfessionalsByUser(user: User) {
    return await this.professionalRepository.find({
      where: { createdBy: user },
    });
  }
}
