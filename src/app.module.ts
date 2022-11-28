import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import process from 'process';
import { AppointmentsModule } from './appointments/appointments.module';
import { AuthModule } from './auth/auth.module';
import { typeOrmConfigAsync } from './config/typeorm.config';
import { FamilyGroupsModule } from './family-groups/family-groups.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { ClinicsModule } from './clinics/clinics.module';
import { GeographyModule } from './geography/geography.module';
import { HttpModule } from '@nestjs/axios';
import { EventsModule } from './events/events.module';
import { MedsShapeModule } from './meds/meds-shape/meds-shape.module';
import { MedsTypeModule } from './meds/meds-type/meds-type.module';
import { MedsDrugModule } from './meds/meds-drug/meds-drug.module';
import { MedsMeasurementUnitModule } from './meds/meds-measurement-unit/meds-measurement-unit.module';
import { MedsModule } from './meds/meds/meds.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeOrmConfigAsync),
    AppointmentsModule,
    AuthModule,
    FamilyGroupsModule,
    ProfessionalsModule,
    ClinicsModule,
    GeographyModule,
    HttpModule,
    EventsModule,
    MedsShapeModule,
    MedsTypeModule,
    MedsDrugModule,
    MedsMeasurementUnitModule,
    MedsModule
  ],
})
export class AppModule {}
