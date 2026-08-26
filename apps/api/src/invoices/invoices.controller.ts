import { Body, Controller, Get, Post } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { InvoiceEntity } from './dto/invoice.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(): Promise<InvoiceEntity[]> {
    return this.invoicesService.list();
  }

  @Post()
  create(@Body() dto: CreateInvoiceDto): Promise<InvoiceEntity> {
    return this.invoicesService.create(dto);
  }
}
