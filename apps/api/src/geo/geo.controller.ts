import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { GeoService } from './geo.service';
import { FlightCheckDto } from './dto/flight-check.dto';

@Controller()
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('geocode-tz')
  geocodeTz(@Query('q') q = '') {
    return this.geoService.geocodeTz(q);
  }

  @Get('geocode-search')
  geocodeSearch(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.geoService.geocodeSearch(q, parseInt(limit ?? '', 10));
  }

  @Get('fbo-lookup')
  fboLookup(@Query('q') q = '') {
    return this.geoService.fboLookup(q);
  }

  @Post('flight-check')
  flightCheck(@Body() dto: FlightCheckDto) {
    return this.geoService.flightCheck(dto);
  }

  @Get('poc-search')
  pocSearch(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.geoService.pocSearch(q, parseInt(limit ?? '', 10));
  }

  @Get('fx-rate')
  fxRate(@Query('currency') currency = '') {
    return this.geoService.fxRate(currency);
  }
}
