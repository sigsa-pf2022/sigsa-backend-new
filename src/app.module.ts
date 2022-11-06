import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import process from "process";
import { AppointmentsModule } from "./appointments/appointments.module";
import { AuthModule } from "./auth/auth.module";
import { FamilyGroupsModule } from "./family-groups/family-groups.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "mysql",
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: "sigsa_db",
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: true,
      // dropSchema: true,
    }),
    AppointmentsModule,
    AuthModule,
    FamilyGroupsModule,
  ],
})
export class AppModule {}
