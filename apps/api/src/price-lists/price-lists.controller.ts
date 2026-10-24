import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { PriceListsService } from './price-lists.service';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { UpdatePriceListDto } from './dto/update-price-list.dto';
import { CreatePriceListEntryDto } from './dto/create-price-list-entry.dto';
import { UpdatePriceListEntryDto } from './dto/update-price-list-entry.dto';
import { ListPriceListsQueryDto } from './dto/list-price-lists-query.dto';
import { SetPriceListClientsDto } from './dto/set-price-list-clients.dto';
import { PriceListEntity } from './dto/price-list.entity';
import { PriceListEntryEntity } from './dto/price-list-entry.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('price-lists')
export class PriceListsController {
  constructor(private readonly priceLists: PriceListsService) {}

  @Get()
  list(@Query() query: ListPriceListsQueryDto): Promise<PriceListEntity[]> {
    return this.priceLists.list(query);
  }

  @Get(':ref')
  get(@Param('ref') ref: string): Promise<PriceListEntity> {
    return this.priceLists.get(ref);
  }

  @Post()
  create(@Body() dto: CreatePriceListDto): Promise<PriceListEntity> {
    return this.priceLists.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdatePriceListDto,
  ): Promise<PriceListEntity> {
    return this.priceLists.update(ref, dto);
  }

  @RequirePermission('record:delete')
  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.priceLists.delete(ref);
  }

  @Put(':ref/clients')
  setClients(
    @Param('ref') ref: string,
    @Body() dto: SetPriceListClientsDto,
  ): Promise<PriceListEntity> {
    return this.priceLists.setClients(ref, dto);
  }

  @Post(':ref/entries')
  addEntry(
    @Param('ref') ref: string,
    @Body() dto: CreatePriceListEntryDto,
  ): Promise<PriceListEntryEntity> {
    return this.priceLists.addEntry(ref, dto);
  }

  @Put(':ref/entries/:entryId')
  updateEntry(
    @Param('ref') ref: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdatePriceListEntryDto,
  ): Promise<PriceListEntryEntity> {
    return this.priceLists.updateEntry(ref, entryId, dto);
  }

  @RequirePermission('record:delete')
  @Delete(':ref/entries/:entryId')
  deleteEntry(
    @Param('ref') ref: string,
    @Param('entryId') entryId: string,
  ): Promise<OkResponseEntity> {
    return this.priceLists.deleteEntry(ref, entryId);
  }
}
