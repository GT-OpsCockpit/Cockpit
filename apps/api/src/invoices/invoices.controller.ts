import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceEntity } from './dto/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicingPeriodEntity } from './dto/invoicing-period.entity';
import { CorrectInvoiceDto } from './dto/correct-invoice.dto';
import { OkResponseEntity } from '../common/dto/ok-response.entity';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/guards/session-auth.guard';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(): Promise<InvoiceEntity[]> {
    return this.invoicesService.list();
  }

  @Get('default-period')
  defaultPeriod(): Promise<InvoicingPeriodEntity> {
    return this.invoicesService.defaultPeriod();
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto): Promise<InvoiceEntity> {
    return this.invoicesService.create(dto);
  }

  @RequirePermission('invoice:correct')
  @Post(':ref/correct')
  correct(
    @Param('ref') ref: string,
    @Body() dto: CorrectInvoiceDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OkResponseEntity> {
    return this.invoicesService.correct(ref, dto.password, user);
  }
}
