import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Put, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateMedsDrugDto } from './dto/create-meds-drug.dto';
import { MedsDrugService } from './meds-drug.service';

@Controller('meds-drug')
export class MedsDrugController {
  constructor(private readonly medsDrugService: MedsDrugService) {}
  @Get()
  async getDrugs(@Req() request) {
    const res = await this.medsDrugService.getDrugs(
      request.query.page,
      request.query.take,
    );
    return { data: res[0], count: res[1] };
  }

    // @UseGuards(RoleGuard(Role.Admin))
    @UsePipes(ValidationPipe)
    @Post('')
    async createDrug(
      @Req() request,
      @Body()
      createMedsDrugDto: CreateMedsDrugDto,
    ) {
      const isExist =
        await this.medsDrugService.getDrugByName(
          createMedsDrugDto.name,
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
      return this.medsDrugService.createDrug(
        createMedsDrugDto,
      );
    }

  @Get('/:id')
  async getDrugById(@Req() request) {
    return await this.medsDrugService.getDrugById(
      request.params.id,
    );
  }

  @Put('/:id')
  async updateDrug(@Req() request, @Body() body) {
    return this.medsDrugService.updateDrug(
      request.params.id,
      body,
    );
  }

  @Delete('/:id')
  async deleteDrug(@Req() request) {
    return this.medsDrugService.deleteDrug(request.params.id);
  }
}
