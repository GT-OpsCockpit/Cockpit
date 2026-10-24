import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePassengerDto } from './create-passenger.dto';

// Routes are edited one at a time through their own sub-resource endpoints
// (POST/PUT/DELETE /api/passengers/:ref/routes/...) — a PUT here only ever
// touches the passenger's own fields, never wipes their saved routes as a
// side effect of an unrelated edit.
export class UpdatePassengerDto extends PartialType(
  OmitType(CreatePassengerDto, ['routes'] as const),
) {}
