import { Global, Module } from '@nestjs/common';
import { EventLinkService } from './event-link.service';

@Global()
@Module({
  providers: [EventLinkService],
  exports: [EventLinkService],
})
export class EventLinkModule {}
