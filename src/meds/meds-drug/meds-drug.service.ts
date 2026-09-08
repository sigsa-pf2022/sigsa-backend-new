import { Get, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { boolFilter, buildWhere, paginate, textFilter } from 'src/common/list-query';
import { CreateMedsDrugDto } from './dto/create-meds-drug.dto';
import { MedsDrug } from './meds-drug.entity';

@Injectable()
export class MedsDrugService {
  constructor(
    @InjectRepository(MedsDrug)
    private medsDrugRepository: Repository<MedsDrug>,
  ) {}

  async getAllDrugs() {
    return this.medsDrugRepository.find({ order: { name: 'ASC' } });
  }

  async getDrugs(page, quantity, deleted?: unknown, name?: string) {
    return this.medsDrugRepository.findAndCount({
      where: buildWhere({
        deleted: boolFilter(deleted),
        name: textFilter(name),
      }),
      ...paginate(page, quantity),
      order: { name: 'ASC' },
    });
  }

  async getDrugById(id: number) {
    return this.medsDrugRepository.findOneBy({ id });
  }
  async getDrugByName(name: string) {
    return this.medsDrugRepository.findOneBy({ name });
  }
  async createDrug(createMedsDrugDto: CreateMedsDrugDto) {
    const newMedsDrug = this.medsDrugRepository.create(createMedsDrugDto);
    return this.medsDrugRepository.save(newMedsDrug);
  }
  async updateDrug(id: number, body) {
    return this.medsDrugRepository.update(
      { id },
      {
        name: body.name,
      },
    );
  }
  async deleteDrug(id: number) {
    return this.medsDrugRepository.update(
      { id },
      {
        deleted: true,
      },
    );
  }
}
