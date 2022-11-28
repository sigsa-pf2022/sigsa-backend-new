import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMedsDto } from './dto/create-meds.dto';
import { UpdateMedsDto } from './dto/update-meds.dto copy';
import { Meds } from './meds.entity';

@Injectable()
export class MedsService {
  constructor(
    @InjectRepository(Meds)
    private medsRepository: Repository<Meds>,
  ) {}

  async getAllMeds() {
    return this.medsRepository.find({
      relations: { drug: true, shape: true, type: true, measurementUnit: true },
    });
  }
  
  async getMeds(page, quantity) {
    return this.medsRepository.findAndCount({
      take: quantity,
      skip: page * quantity,
      order: { name: 'ASC' },
      relations: {
        shape: true,
        type: true,
        measurementUnit: true,
        drug: true,
      },
    });
  }

  async getMedById(id: number) {
    return this.medsRepository.findOne({
      where: { id },
      relations: {
        shape: true,
        type: true,
        measurementUnit: true,
        drug: true,
      },
    });
  }
  async getMedByName(name: string) {
    return this.medsRepository.findOneBy({ name });
  }
  async createMed(createMedsDto: CreateMedsDto) {
    const newMed = this.medsRepository.create(createMedsDto);
    return this.medsRepository.save(newMed);
  }
  async updateMed(id: number, updateMedsDto: UpdateMedsDto) {
    return this.medsRepository.update(
      { id },
      {
        ...updateMedsDto,
      },
    );
  }
  async deleteMed(id: number) {
    return this.medsRepository.update(
      { id },
      {
        deleted: true,
      },
    );
  }
}
