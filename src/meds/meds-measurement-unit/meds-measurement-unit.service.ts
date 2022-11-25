import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMedsMeasurementUnitDto } from './dto/create-meds-measurement-unit.dto';
import { MedsMeasurementUnit } from './meds-measurement-unit.entity';

@Injectable()
export class MedsMeasurementUnitService {
  constructor(
    @InjectRepository(MedsMeasurementUnit)
    private medsMeasurementUnitRepository: Repository<MedsMeasurementUnit>,
  ) {}

  async getMeasurementUnits(page, quantity) {
    return this.medsMeasurementUnitRepository.findAndCount({
      take: quantity,
      skip: page * quantity,
      order: { name: 'ASC' },
    });
  }

  async getMeasurementUnitById(id: number) {
    return this.medsMeasurementUnitRepository.findOneBy({ id });
  }
  async getMeasurementUnitByName(name: string) {
    return this.medsMeasurementUnitRepository.findOneBy({ name });
  }
  async createMeasurementUnit(createMedsMeasurementUnitDto: CreateMedsMeasurementUnitDto) {
    const newMedsMeasurementUnit = this.medsMeasurementUnitRepository.create(createMedsMeasurementUnitDto);
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
