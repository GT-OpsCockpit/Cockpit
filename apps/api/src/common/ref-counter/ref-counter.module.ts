import { Global, Module } from '@nestjs/common';
import { RefCounterService } from './ref-counter.service';

@Global()
@Module({
  providers: [RefCounterService],
  exports: [RefCounterService],
})
export class RefCounterModule {}
