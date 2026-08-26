import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list() {
    return this.clientsService.list();
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Put(':ref')
  update(@Param('ref') ref: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string) {
    return this.clientsService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(@Param('ref') ref: string, @Body() dto: SetActiveDto) {
    return this.clientsService.setActive(ref, dto.active);
  }
}
