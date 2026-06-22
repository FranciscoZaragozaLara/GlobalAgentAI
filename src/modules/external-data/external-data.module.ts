import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesDataService } from './application/sales-data.service';
import { SalesAnalyticsService } from './application/sales-analytics.service';
import { ExternalDataController } from './interfaces/external-data.controller';

@Module({
  imports: [AuthModule],
  providers: [SalesDataService, SalesAnalyticsService],
  controllers: [ExternalDataController],
  exports: [SalesDataService, SalesAnalyticsService],
})
export class ExternalDataModule {}

