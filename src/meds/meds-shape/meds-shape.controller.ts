import { Body, Controller, Delete, Get, HttpException, HttpStatus, Post, Put, Req, UsePipes, ValidationPipe } from '@nestjs/common';
import { CreateMedsShapeDto } from './dto/create-meds-shape.dto';
import { MedsShapeService } from './meds-shape.service';

@Controller('meds-shape')
export class MedsShapeController {
  constructor(private readonly medsShapeService: MedsShapeService) {}
  @Get('all')
  async getAllShapes() {
    return await this.medsShapeService.getAllShapes();
  }
  @Get()
  async getShapes(@Req() request) {
    const res = await this.medsShapeService.getShapes(
      request.query.page,
      request.query.take,
    );
    return { data: res[0], count: res[1] };
  }

    // @UseGuards(RoleGuard(Role.Admin))
    @UsePipes(ValidationPipe)
    @Post('')
    async createShape(
      @Req() request,
      @Body()
      createMedsShapeDto: CreateMedsShapeDto,
    ) {
      const isExist =
        await this.medsShapeService.getShapeByName(
          createMedsShapeDto.name,
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
      return this.medsShapeService.createShape(
        createMedsShapeDto,
      );
    }

  @Get('/:id')
  async getShapeById(@Req() request) {
    return await this.medsShapeService.getShapeById(
      request.params.id,
    );
  }

  @Put('/:id')
  async updateShape(@Req() request, @Body() body) {
    return this.medsShapeService.updateShape(
      request.params.id,
      body,
    );
  }

  @Delete('/:id')
  async deleteShape(@Req() request) {
    return this.medsShapeService.deleteShape(request.params.id);
  }
}
