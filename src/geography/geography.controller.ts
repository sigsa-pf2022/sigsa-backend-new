import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.guard';
import { GeographyService } from './geography.service';

@Controller('geography')
export class GeographyController {
  constructor(private readonly geographyService: GeographyService) {}
  @UseGuards(JwtAuthGuard)
  @Get('/countries')
  async getCountries() {
    return this.geographyService.getCountries();
  }

  @Get('/states/:countryId')
  async getStatesByCountry(@Request() req) {
    const country = await this.geographyService.getCountryById(
      req.params.countryId,
    );
    if (!country) {
      throw new HttpException(
        {
          message: 'No se encontraron provincias para el pais seleccionado',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.geographyService.getStatesByCountry(country);
  }
  @UseGuards(JwtAuthGuard)
  @Get('/cityies/:stateId')
  async getCitiesByState(@Request() req) {
    const state = await this.geographyService.getStateById(req.params.stateId);
    if (!state) {
      throw new HttpException(
        {
          message: 'No se encontro la provincia seleccionada',
          status: 'error',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return this.geographyService.getCitiesByState(state);
  }
}
