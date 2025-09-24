import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMedsDto } from './dto/create-meds.dto';
import { UpdateMedsDto } from './dto/update-meds.dto';
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
    const entity = this.medsRepository.create({
      name: createMedsDto.name,
      laboratory: createMedsDto.laboratory,
      code: createMedsDto.code,
      dosage: createMedsDto.dosage,
      drug: { id: createMedsDto.drug } as any,
      shape: { id: createMedsDto.shape } as any,
      type: { id: createMedsDto.type } as any,
      measurementUnit: { id: createMedsDto.measurementUnit } as any,
    });
    try {
      return await this.medsRepository.save(entity);
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new ConflictException('El nombre ya existe');
      }
      throw new InternalServerErrorException('Error al crear medicamento');
    }
  }
  async updateMed(id: number, updateMedsDto: UpdateMedsDto) {
    const med = await this.medsRepository.findOne({ where: { id: Number(id) } });
    if (!med) throw new NotFoundException('Medicamento no encontrado');

    const patch: any = { ...updateMedsDto };
    if (updateMedsDto.drug) patch.drug = { id: updateMedsDto.drug };
    if (updateMedsDto.shape) patch.shape = { id: updateMedsDto.shape };
    if (updateMedsDto.type) patch.type = { id: updateMedsDto.type };
    if (updateMedsDto.measurementUnit) patch.measurementUnit = { id: updateMedsDto.measurementUnit };
    try {
      await this.medsRepository.update({ id: Number(id) }, patch);
      return this.getMedById(Number(id));
    } catch (e: any) {
      if (e?.code === '23505') {
        throw new ConflictException('El nombre ya existe');
      }
      throw new InternalServerErrorException('Error al actualizar medicamento');
    }
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
