import { Controller, Get, Query } from '@nestjs/common';
import { MetaService } from './meta.service';
import { MetaEntity } from './dto/meta.entity';
import { AreaSuggestionsQueryDto } from './dto/area-suggestions-query.dto';
import { AreaSuggestionsEntity } from './dto/area-suggestions.entity';

@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get()
  getMeta(): Promise<MetaEntity> {
    return this.metaService.getMeta();
  }

  @Get('areas')
  getAreaSuggestions(
    @Query() query: AreaSuggestionsQueryDto,
  ): AreaSuggestionsEntity {
    return this.metaService.getAreaSuggestions(query.countryCode);
  }
}
