import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from 'src/users/user.entity';
import { Repository } from 'typeorm';
import { CreateDependentDto } from './dto/create-dependent.dto';
import { Dependent } from './entities/dependent.entity';
import { FamilyGroup } from './entities/family-group.entity';

@Injectable()
export class FamilyGroupsService {
  constructor(
    @InjectRepository(FamilyGroup)
    private familyGroupRepository: Repository<FamilyGroup>,
    @InjectRepository(Dependent)
    private dependentRepository: Repository<Dependent>,
  ) {}

  async createGroup(
    name: string,
    createDependentDto: CreateDependentDto,
    user: User,
    members: User[],
  ) {
    const newDependent = await this.createDependent(createDependentDto);
    console.log(members);
    const newFamilyGroup = this.familyGroupRepository.create({
      name,
      dependent: newDependent,
      createdBy: user,
      members,
    });
    return this.familyGroupRepository.save(newFamilyGroup);
  }

  createDependent(createDependentDto: CreateDependentDto) {
    const newDependent = this.dependentRepository.create(createDependentDto);
    return this.dependentRepository.save(newDependent);
  }

  async getFamilyGroupsByUser(user: User) {
    return await this.familyGroupRepository.find({
      where: { createdBy: user },
      relations: {
        members: true,
      },
    });
  }

  async getFamilyGroupById(id: number) {
    return await this.familyGroupRepository.findOne({
      where: { id },
      relations: {
        dependent: true,
        members: true,
      },
    });
  }
}
