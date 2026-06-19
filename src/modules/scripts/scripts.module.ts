import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DemoSalesPlanScript } from './application/demo-sales-plan.script';
import { ScriptRunnerService } from './application/script-runner.service';
import { ScriptsController } from './interfaces/scripts.controller';

@Module({
  imports: [NotificationsModule],
  providers: [DemoSalesPlanScript, ScriptRunnerService],
  controllers: [ScriptsController],
})
export class ScriptsModule {}
