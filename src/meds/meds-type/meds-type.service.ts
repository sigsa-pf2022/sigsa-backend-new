import { Get, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CreateMedsTypeDto } from './dto/create-meds-type.dto';
import { MedsType } from './meds-type.entity';

@Injectable()
export class MedsTypeService {
  constructor(
    @InjectRepository(MedsType)
    private medsTypeRepository: Repository<MedsType>,
  ) {}

  async getAllTypes() {
    return this.medsTypeRepository.find({
      order: { name: 'ASC' },
    });
  }
  async getTypes(
    page: number,
    quantity: number,
    deleted: boolean,
    name: string,
    description: string,
  ) {
    return this.medsTypeRepository.findAndCount({
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

  async getTypeById(id: number) {
    return this.medsTypeRepository.findOneBy({ id });
  }
  async getTypeByName(name: string) {
    return this.medsTypeRepository.findOneBy({ name });
  }
  async createType(createMedsTypeDto: CreateMedsTypeDto) {
    const newMedsType = this.medsTypeRepository.create(createMedsTypeDto);
    return this.medsTypeRepository.save(newMedsType);
  }
  async updateType(id: number, body) {
    return this.medsTypeRepository.update(
      { id },
      {
        name: body.name,
        description: body.description,
      },
    );
  }
  async deleteType(id: number) {
    return this.medsTypeRepository.update(
      { id },
      {
        deleted: true,
      },
    );
  }
}
