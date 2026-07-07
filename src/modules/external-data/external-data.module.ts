import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesDataService } from './application/sales-data.service';
import { SalesAnalyticsService } from './application/sales-analytics.service';
import { AftersalesDataService } from './application/aftersales-data.service';
import { AftersalesAnalyticsService } from './application/aftersales-analytics.service';
import { ExternalDataController } from './interfaces/external-data.controller';

@Module({
  imports: [AuthModule],
  providers: [
    SalesDataService,
    SalesAnalyticsService,
    AftersalesDataService,
    AftersalesAnalyticsService,
  ],
  controllers: [ExternalDataController],
  exports: [
    SalesDataService,
    SalesAnalyticsService,
    AftersalesDataService,
    AftersalesAnalyticsService,
  ],
})
export class ExternalDataModule {}

