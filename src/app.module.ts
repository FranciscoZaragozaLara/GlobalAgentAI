import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { GeminiModule } from './modules/gemini/gemini.module';
import { AuthModule } from './modules/auth/auth.module';
import { ExternalDataModule } from './modules/external-data/external-data.module';

@Module({
  imports: [AppConfigModule, ScriptsModule, GeminiModule, AuthModule, ExternalDataModule],
})
export class AppModule {}



