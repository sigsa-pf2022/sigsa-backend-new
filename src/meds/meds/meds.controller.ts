import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Post,
  Put,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { CreateMedsDto } from './dto/create-meds.dto';
import { UpdateMedsDto } from './dto/update-meds.dto copy';
import { MedsService } from './meds.service';

@Controller('meds')
export class MedsController {
  constructor(private readonly medsService: MedsService) {}

  @Get('/all')
  async getAllMeds() {
    return await this.medsService.getAllMeds();
  }
  @Get()
  async getMeds(@Req() request) {
    const res = await this.medsService.getMeds(
      request.query.page,
      request.query.take,
    );
    return { data: res[0], count: res[1] };
  }
  // @UseGuards(RoleGuard(Role.Admin))
  @UsePipes(ValidationPipe)
  @Post('')
  async createMed(
    @Req() request,
    @Body()
    createMedsDto: CreateMedsDto,
  ) {
    const isExist = await this.medsService.getMedByName(createMedsDto.name);
    if (Boolean(isExist)) {
      throw new HttpException(
        {
          message: 'Ya existe una forma de medicamento con ese nombre',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.medsService.createMed(createMedsDto);
  }

  @Get('/:id')
  async getMedById(@Req() request) {
    const med = await this.medsService.getMedById(request.params.id);
    return {
      ...med,
      shape: med.shape.id,
      type: med.type.id,
      measurementUnit: med.measurementUnit.id,
      drug: med.drug.id,
    };
  }

  @Put('/:id')
  async updateMed(@Req() request, @Body() updateMedsDto: UpdateMedsDto) {
    return this.medsService.updateMed(request.params.id, updateMedsDto);
  }
}
