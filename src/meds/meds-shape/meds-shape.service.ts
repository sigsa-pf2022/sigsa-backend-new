import { Get, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { boolFilter, buildWhere, paginate, textFilter } from 'src/common/list-query';
import { CreateMedsShapeDto } from './dto/create-meds-shape.dto';
import { MedsShape } from './meds-shape.entity';

@Injectable()
export class MedsShapeService {
  constructor(
    @InjectRepository(MedsShape)
    private medsShapeRepository: Repository<MedsShape>,
  ) {}

  async getAllShapes() {
    return this.medsShapeRepository.find({
      order: { name: 'ASC' },
    });
  }
  async getShapes(page, quantity, deleted?: unknown, name?: string) {
    return this.medsShapeRepository.findAndCount({
      where: buildWhere({
        deleted: boolFilter(deleted),
        name: textFilter(name),
      }),
      ...paginate(page, quantity),
      order: { name: 'ASC' },
    });
  }

  async getShapeById(id: number) {
    return this.medsShapeRepository.findOneBy({ id });
  }
  async getShapeByName(name: string) {
    return this.medsShapeRepository.findOneBy({ name });
  }
  async createShape(createMedsShapeDto: CreateMedsShapeDto) {
    const newMedsShape = this.medsShapeRepository.create(createMedsShapeDto);
    return this.medsShapeRepository.save(newMedsShape);
  }
  async updateShape(id: number, body) {
    return this.medsShapeRepository.update(
      { id },
      {
        name: body.name,
      },
    );
  }
  async deleteShape(id: number) {
    return this.medsShapeRepository.update(
      { id },
      {
        deleted: true,
      },
    );
  }
}
