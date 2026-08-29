import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripRefService } from './trip-ref.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CompanyModule } from '../company/company.module';
import { StorageModule } from '../common/storage/storage.module';
import { NameboardController } from './nameboard.controller';

@Module({
  imports: [NotificationsModule, RealtimeModule, CompanyModule, StorageModule],
  controllers: [TripsController, NameboardController],
  providers: [TripsService, TripRefService],
})
export class TripsModule {}
