import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import process from "process";
import { AppointmentsModule } from "./appointments/appointments.module";
import { AuthModule } from "./auth/auth.module";
import { typeOrmConfigAsync } from "./config/typeorm.config";
import { FamilyGroupsModule } from "./family-groups/family-groups.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync(typeOrmConfigAsync),
    AppointmentsModule,
    AuthModule,
    FamilyGroupsModule,
  ],
})
export class AppModule {}
