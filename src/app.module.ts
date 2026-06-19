import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { ScriptsModule } from './modules/scripts/scripts.module';

@Module({
  imports: [AppConfigModule, ScriptsModule],
})
export class AppModule {}
