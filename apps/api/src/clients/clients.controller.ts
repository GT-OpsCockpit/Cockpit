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
import { SetClientPriceListsDto } from './dto/set-client-price-lists.dto';
import { PriceListEntity } from '../price-lists/dto/price-list.entity';
import { CreateClientContactDto } from './dto/create-client-contact.dto';
import { UpdateClientContactDto } from './dto/update-client-contact.dto';
import { ReorderClientContactsDto } from './dto/reorder-client-contacts.dto';
import { ClientContactEntity } from './dto/client-contact.entity';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';
import { ReactivateDto } from './dto/reactivate.dto';
import { ReactivateResponseEntity } from './dto/reactivate-response.entity';
import { ReactivationCandidatesEntity } from './dto/reactivation-candidates.entity';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  // Filtering/pagination happen server-side (search/type/includeInactive/page/limit)
  // — see ClientsService.list(). Not a plain findMany()-then-filter-in-the-browser
  // like it used to be — see ADR-0001 for the one documented exception to this rule.
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

  @Get(':ref/price-lists')
  listPriceLists(@Param('ref') ref: string): Promise<PriceListEntity[]> {
    return this.clientsService.listPriceLists(ref);
  }

  @Put(':ref/price-lists')
  setPriceLists(
    @Param('ref') ref: string,
    @Body() dto: SetClientPriceListsDto,
  ): Promise<PriceListEntity[]> {
    return this.clientsService.setPriceLists(ref, dto.priceListRefs);
  }

  @Get(':ref/contacts')
  listContacts(@Param('ref') ref: string): Promise<ClientContactEntity[]> {
    return this.clientsService.listContacts(ref);
  }

  @Post(':ref/contacts')
  addContact(
    @Param('ref') ref: string,
    @Body() dto: CreateClientContactDto,
  ): Promise<ClientContactEntity> {
    return this.clientsService.addContact(ref, dto);
  }

  // Registered ahead of :contactId below — Nest matches routes in
  // declaration order, and "reorder" would otherwise be swallowed as a
  // contact id by the dynamic route.
  @Put(':ref/contacts/reorder')
  reorderContacts(
    @Param('ref') ref: string,
    @Body() dto: ReorderClientContactsDto,
  ): Promise<ClientContactEntity[]> {
    return this.clientsService.reorderContacts(ref, dto);
  }

  @Put(':ref/contacts/:contactId')
  updateContact(
    @Param('ref') ref: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateClientContactDto,
  ): Promise<ClientContactEntity> {
    return this.clientsService.updateContact(ref, contactId, dto);
  }

  @RequirePermission('record:delete')
  @Delete(':ref/contacts/:contactId')
  deleteContact(
    @Param('ref') ref: string,
    @Param('contactId') contactId: string,
  ): Promise<OkResponseEntity> {
    return this.clientsService.deleteContact(ref, contactId);
  }

  // Offered right after an Events account is created: the crew already set up
  // for this location under a previous, now-finished Event
  // (offerEventReactivation, common.js:3912).
  @Get(':ref/reactivation-candidates')
  listReactivationCandidates(
    @Param('ref') ref: string,
  ): Promise<ReactivationCandidatesEntity> {
    return this.clientsService.listReactivationCandidates(ref);
  }

  @Post(':ref/reactivate')
  reactivate(
    @Param('ref') ref: string,
    @Body() dto: ReactivateDto,
  ): Promise<ReactivateResponseEntity> {
    return this.clientsService.reactivate(ref, dto);
  }
}
