import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [AppConfigModule, ScriptsModule, GeminiModule, AuthModule],
})
export class AppModule {}


