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
import {
  TripEntity,
  UpdateTripResponseEntity,
  CancelAssignmentResponseEntity,
  TripActionResponseEntity,
} from './dto/trip.entity';
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
  list(): Promise<TripEntity[]> {
    return this.tripsService.list();
  }

  @Public()
  @Get(':ref')
  getPublic(
    @Param('ref') ref: string,
    @Query('viewer') viewer?: string,
  ): Promise<TripEntity> {
    return this.tripsService.getPublic(ref, viewer === 'driver');
  }

  @Post()
  create(@Body() dto: CreateTripDto): Promise<TripEntity> {
    return this.tripsService.create(dto);
  }

  @Put(':ref')
  update(
    @Param('ref') ref: string,
    @Body() dto: UpdateTripDto,
  ): Promise<UpdateTripResponseEntity> {
    return this.tripsService.update(ref, dto);
  }

  @Post(':ref/cancel-assignment')
  cancelAssignment(
    @Param('ref') ref: string,
    @Body() dto: CancelAssignmentDto,
  ): Promise<CancelAssignmentResponseEntity> {
    return this.tripsService.cancelAssignment(ref, dto);
  }

  @Post(':ref/advance-step')
  advanceStep(@Param('ref') ref: string): Promise<TripActionResponseEntity> {
    return this.tripsService.advanceStep(ref);
  }

  @Public()
  @Post(':ref/notify')
  notify(
    @Param('ref') ref: string,
    @Body() dto: NotifyStepDto,
  ): Promise<TripActionResponseEntity> {
    return this.tripsService.notify(ref, dto.step);
  }

  @Post(':ref/dispatch-driver')
  dispatchDriver(@Param('ref') ref: string): Promise<TripEntity> {
    return this.tripsService.dispatchDriver(ref);
  }

  // File upload (multipart) endpoint — not a good REST-codegen candidate
  // (orval/OpenAPI don't model `multipart/form-data` + Multer well), left
  // without an explicit return-type annotation by design.
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
