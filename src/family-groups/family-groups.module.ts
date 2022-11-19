import { Module } from '@nestjs/common';
import { FamilyGroupsService } from './family-groups.service';
import { FamilyGroupsController } from './family-groups.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dependent } from 'src/family-groups/entities/dependent.entity';
import { FamilyGroup } from './entities/family-group.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Dependent, FamilyGroup]), UsersModule],
  providers: [FamilyGroupsService],
  controllers: [FamilyGroupsController],
})
export class FamilyGroupsModule {}
