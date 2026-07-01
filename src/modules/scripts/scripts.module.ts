import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeminiModule } from '../gemini/gemini.module';
import { AuthModule } from '../auth/auth.module';
import { ExternalDataModule } from '../external-data/external-data.module';
import { DemoSalesPlanScript } from './application/demo-sales-plan.script';
import { DemoAftersalesPlanScript } from './application/demo-aftersales-plan.script';
import { ScriptRunnerService } from './application/script-runner.service';
import { ScriptsController } from './interfaces/scripts.controller';

@Module({
  imports: [NotificationsModule, GeminiModule, AuthModule, ExternalDataModule],
  providers: [DemoSalesPlanScript, DemoAftersalesPlanScript, ScriptRunnerService],
  controllers: [ScriptsController],
})
export class ScriptsModule {}



