import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Put, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateMedsTypeDto } from './dto/create-meds-type.dto';
import { MedsTypeService } from './meds-type.service';

@Controller('meds-type')
export class MedsTypeController {
  constructor(private readonly medsTypeService: MedsTypeService) {}
  @Get('all')
  async getAllTypes() {
    return await this.medsTypeService.getAllTypes();
  }
  @Get()
  async getTypes(@Req() request) {
    const res = await this.medsTypeService.getTypes(
      request.query.page,
      request.query.take,
      request.query.deleted,
      request.query.name,
      request.query.description,
    );
    return { data: res[0], total: res[1], count: res[0].length };
  }

    // @UseGuards(RoleGuard(Role.Admin))
    @UsePipes(ValidationPipe)
    @Post('')
    async createType(
      @Req() request,
      @Body()
      createMedsTypeDto: CreateMedsTypeDto,
    ) {
      const isExist =
        await this.medsTypeService.getTypeByName(
          createMedsTypeDto.name,
        );
      if (Boolean(isExist)) {
        throw new HttpException(
          {
            message: 'Ya existe una tipo de medicamento con ese nombre',
            status: 'error',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      return this.medsTypeService.createType(
        createMedsTypeDto,
      );
    }

  @Get('/:id')
  async getTypeById(@Req() request) {
    return await this.medsTypeService.getTypeById(
      request.params.id,
    );
  }

  @Put('/:id')
  async updateType(@Req() request, @Body() body) {
    return this.medsTypeService.updateType(
      request.params.id,
      body,
    );
  }

  @Delete('/:id')
  async deleteType(@Req() request) {
    return this.medsTypeService.deleteType(request.params.id);
  }
}
