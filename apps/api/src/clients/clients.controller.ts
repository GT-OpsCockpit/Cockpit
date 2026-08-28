import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { SetActiveDto } from '../common/dto/set-active.dto';
import { ClientListEntity } from './dto/client-list.entity';
import { ClientEntity } from './dto/client.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // Filtering/pagination happen server-side (search/type/includeInactive/page/limit)
  // — see ClientsService.list() and docs/FRONTEND_PLAN.md's 2026-08-27 journal entry
  // for why this isn't a plain findMany()-then-filter-in-the-browser like it used to be.
  @Get()
  list(@Query() query: ListClientsQueryDto): Promise<ClientListEntity> {
    return this.clientsService.list(query);
  }

  @Post()
  create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientEntity> {
    return this.clientsService.create(dto, user);
  }

  // Mirrors the legacy's manager-password gate on saving a client edit
  // (LEGACY_FEATURES.md §10 clients.html) — unconditional, no business-rule
  // exception, same shape as TripsController.cancelAssignment's trip:cancel.
  @RequirePermission('client:edit')
  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdateClientDto,
  ): Promise<ClientEntity> {
    return this.clientsService.update(ref, dto);
  }

  // Permanent, unrecoverable — the legacy put every hard-delete behind the
  // Manager password (common.js:385-395). See docs/agents/permissions.md.
  @RequirePermission('record:delete')
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
