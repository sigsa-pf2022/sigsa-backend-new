import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { boolFilter, buildWhere, paginate, textFilter } from 'src/common/list-query';
import { CreateMedsMeasurementUnitDto } from './dto/create-meds-measurement-unit.dto';
import { MedsMeasurementUnit } from './meds-measurement-unit.entity';

@Injectable()
export class MedsMeasurementUnitService {
  constructor(
    @InjectRepository(MedsMeasurementUnit)
    private medsMeasurementUnitRepository: Repository<MedsMeasurementUnit>,
  ) {}

  async getAllMeasurementUnits() {
    return this.medsMeasurementUnitRepository.find({
      order: { name: 'ASC' },
    });
  }
  async getMeasurementUnits(page, quantity, deleted?: unknown, name?: string) {
    return this.medsMeasurementUnitRepository.findAndCount({
      where: buildWhere({
        deleted: boolFilter(deleted),
        name: textFilter(name),
      }),
      ...paginate(page, quantity),
      order: { name: 'ASC' },
    });
  }

  async getMeasurementUnitById(id: number) {
    return this.medsMeasurementUnitRepository.findOneBy({ id });
  }
  async getMeasurementUnitByName(name: string) {
    return this.medsMeasurementUnitRepository.findOneBy({ name });
  }
  async createMeasurementUnit(
    createMedsMeasurementUnitDto: CreateMedsMeasurementUnitDto,
  ) {
    const newMedsMeasurementUnit = this.medsMeasurementUnitRepository.create(
      createMedsMeasurementUnitDto,
    );
    return this.medsMeasurementUnitRepository.save(newMedsMeasurementUnit);
  }
  async updateMeasurementUnit(id: number, body) {
    return this.medsMeasurementUnitRepository.update(
      { id },
      {
        name: body.name,
      },
    );
  }
  async deleteMeasurementUnit(id: number) {
    return this.medsMeasurementUnitRepository.update(
      { id },
      {
        deleted: true,
      },
    );
  }
}
