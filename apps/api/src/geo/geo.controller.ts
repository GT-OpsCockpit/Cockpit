import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GeoService } from './geo.service';
import {
  GeocodeTzEntity,
  GeocodeSearchResponseEntity,
  FboLookupEntity,
  FlightCheckResponseEntity,
  PocSearchResponseEntity,
  FxRateEntity,
} from './dto/geo-response.entity';
import { FlightCheckDto } from './dto/flight-check.dto';

@Controller()
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('geocode-tz')
  geocodeTz(@Query('q') q = ''): Promise<GeocodeTzEntity> {
    return this.geoService.geocodeTz(q);
  }

  @Get('geocode-search')
  geocodeSearch(
    @Query('q') q = '',
    @Query('limit') limit?: string,
  ): Promise<GeocodeSearchResponseEntity> {
    return this.geoService.geocodeSearch(q, parseInt(limit ?? '', 10));
  }

  @Get('fbo-lookup')
  fboLookup(@Query('q') q = ''): FboLookupEntity {
    return this.geoService.fboLookup(q);
  }

  @Post('flight-check')
  flightCheck(@Body() dto: FlightCheckDto): Promise<FlightCheckResponseEntity> {
    return this.geoService.flightCheck(dto);
  }

  @Get('poc-search')
  pocSearch(
    @Query('q') q = '',
    @Query('limit') limit?: string,
  ): Promise<PocSearchResponseEntity> {
    return this.geoService.pocSearch(q, parseInt(limit ?? '', 10));
  }

  @Get('fx-rate')
  fxRate(@Query('currency') currency = ''): Promise<FxRateEntity> {
    return this.geoService.fxRate(currency);
  }
}
