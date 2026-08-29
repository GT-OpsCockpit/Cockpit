import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';

/** Import this from any feature module that needs to store or read uploaded files. */
@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
