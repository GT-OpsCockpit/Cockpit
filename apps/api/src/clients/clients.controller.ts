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
import { ClientEntity } from './dto/client.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(): Promise<ClientEntity[]> {
    return this.clientsService.list();
  }

  @Post()
  create(@Body() dto: CreateClientDto): Promise<ClientEntity> {
    return this.clientsService.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientEntity> {
    return this.clientsService.update(ref, dto);
  }

  @Delete(':ref')
  delete(@Param('ref') ref: string): Promise<OkResponseEntity> {
    return this.clientsService.delete(ref);
  }

  @Patch(':ref/active')
  setActive(
    @Param('ref') ref: string,
    @Body() dto: SetActiveDto,
  ): Promise<ClientEntity> {
    return this.clientsService.setActive(ref, dto.active);
  }
}
