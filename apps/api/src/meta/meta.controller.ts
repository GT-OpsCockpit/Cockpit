import { Controller, Get } from '@nestjs/common';
import { MetaService } from './meta.service';
import { MetaEntity } from './dto/meta.entity';

@Controller('meta')
export class MetaController {
  constructor(private readonly metaService: MetaService) {}

  @Get()
  getMeta(): Promise<MetaEntity> {
    return this.metaService.getMeta();
  }
}
