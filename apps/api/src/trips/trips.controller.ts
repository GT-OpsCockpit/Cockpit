import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';
import { CancelAssignmentDto } from './dto/cancel-assignment.dto';
import { NotifyStepDto } from './dto/notify-step.dto';
import { Public } from '../common/decorators/public.decorator';
import { nameboardMulterOptions } from './nameboard-upload.config';

interface UploadedNameboard {
  filename: string;
}

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  list() {
    return this.tripsService.list();
  }

  @Public()
  @Get(':ref')
  getPublic(@Param('ref') ref: string, @Query('viewer') viewer?: string) {
    return this.tripsService.getPublic(ref, viewer === 'driver');
  }

  @Post()
  create(@Body() dto: CreateTripDto) {
    return this.tripsService.create(dto);
  }

  @Put(':ref')
  update(@Param('ref') ref: string, @Body() dto: UpdateTripDto) {
    return this.tripsService.update(ref, dto);
  }

  @Post(':ref/cancel-assignment')
  cancelAssignment(
    @Param('ref') ref: string,
    @Body() dto: CancelAssignmentDto,
  ) {
    return this.tripsService.cancelAssignment(ref, dto);
  }

  @Post(':ref/advance-step')
  advanceStep(@Param('ref') ref: string) {
    return this.tripsService.advanceStep(ref);
  }

  @Public()
  @Post(':ref/notify')
  notify(@Param('ref') ref: string, @Body() dto: NotifyStepDto) {
    return this.tripsService.notify(ref, dto.step);
  }

  @Post(':ref/dispatch-driver')
  dispatchDriver(@Param('ref') ref: string) {
    return this.tripsService.dispatchDriver(ref);
  }

  @Post(':ref/nameboard')
  @UseInterceptors(FileInterceptor('file', nameboardMulterOptions))
  uploadNameboard(
    @Param('ref') ref: string,
    @UploadedFile() file?: UploadedNameboard,
  ) {
    if (!file) throw new BadRequestException('file is required');
    return this.tripsService.setNameboard(ref, file.filename);
  }
}
