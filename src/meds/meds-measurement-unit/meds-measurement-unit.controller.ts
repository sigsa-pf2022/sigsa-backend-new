import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Put, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateMedsMeasurementUnitDto } from './dto/create-meds-measurement-unit.dto';
import { MedsMeasurementUnitService } from './meds-measurement-unit.service';

@Controller('meds-measurement-unit')
export class MedsMeasurementUnit {
  constructor(private readonly medsMeasurementUnitService: MedsMeasurementUnitService) {}
  @Get()
  async getMeasurementUnits(@Req() request) {
    const res = await this.medsMeasurementUnitService.getMeasurementUnits(
      request.query.page,
      request.query.take,
    );
    return { data: res[0], count: res[1] };
  }

    // @UseGuards(RoleGuard(Role.Admin))
    @UsePipes(ValidationPipe)
    @Post('')
    async createMeasurementUnit(
      @Req() request,
      @Body()
      createMedsMeasurementUnitDto: CreateMedsMeasurementUnitDto,
    ) {
      const isExist =
        await this.medsMeasurementUnitService.getMeasurementUnitByName(
          createMedsMeasurementUnitDto.name,
        );
      if (Boolean(isExist)) {
        throw new HttpException(
          {
            message: 'Ya existe una forma de medicamento con ese nombre',
            status: 'error',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      return this.medsMeasurementUnitService.createMeasurementUnit(
        createMedsMeasurementUnitDto,
      );
    }

  @Get('/:id')
  async getMeasurementUnitById(@Req() request) {
    return await this.medsMeasurementUnitService.getMeasurementUnitById(
      request.params.id,
    );
  }

  @Put('/:id')
  async updateMeasurementUnit(@Req() request, @Body() body) {
    return this.medsMeasurementUnitService.updateMeasurementUnit(
      request.params.id,
      body,
    );
  }

  @Delete('/:id')
  async deleteMeasurementUnit(@Req() request) {
    return this.medsMeasurementUnitService.deleteMeasurementUnit(request.params.id);
  }
}
