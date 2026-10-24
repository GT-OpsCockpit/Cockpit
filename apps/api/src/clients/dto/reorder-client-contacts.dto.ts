import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ReorderClientContactsDto {
  // Every contact id for this client, in the order they should now be
  // listed — checked against the client's actual contacts in the service
  // (same set, none missing, none extra) rather than trusted outright.
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  contactIds: string[];
}
