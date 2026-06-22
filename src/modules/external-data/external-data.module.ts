import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesDataService } from './application/sales-data.service';
import { ExternalDataController } from './interfaces/external-data.controller';

@Module({
  imports: [AuthModule],
  providers: [SalesDataService],
  controllers: [ExternalDataController],
  exports: [SalesDataService],
})
export class ExternalDataModule {}
