import { PartialType } from '@nestjs/swagger';
import { CreatePassengerRouteDto } from './create-passenger-route.dto';

export class UpdatePassengerRouteDto extends PartialType(
  CreatePassengerRouteDto,
) {}
