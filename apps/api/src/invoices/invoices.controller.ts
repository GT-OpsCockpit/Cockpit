import { Body, Controller, Get, Post } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceEntity } from './dto/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicingPeriodEntity } from './dto/invoicing-period.entity';

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
}
