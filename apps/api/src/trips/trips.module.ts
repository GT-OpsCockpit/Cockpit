import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { TripRefService } from './trip-ref.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CompanyModule } from '../company/company.module';
import { StorageModule } from '../common/storage/storage.module';
import { NameboardController } from './nameboard.controller';
import { PartnerLinksController } from './partner-links.controller';
import { MailerModule } from '../common/mailer/mailer.module';

@Module({
  imports: [
    NotificationsModule,
    RealtimeModule,
    CompanyModule,
    StorageModule,
    MailerModule,
  ],
  controllers: [TripsController, NameboardController, PartnerLinksController],
  providers: [TripsService, TripRefService],
})
export class TripsModule {}
