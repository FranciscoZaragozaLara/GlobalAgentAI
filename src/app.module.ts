import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { GeminiModule } from './modules/gemini/gemini.module';

@Module({
  imports: [AppConfigModule, ScriptsModule, GeminiModule],
})
export class AppModule {}

