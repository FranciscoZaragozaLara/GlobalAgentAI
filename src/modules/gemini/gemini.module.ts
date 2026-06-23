import { Module } from '@nestjs/common';
import { GeminiService } from './application/gemini.service';
import { ResearchStorageService } from './application/research-storage.service';

@Module({
  providers: [GeminiService, ResearchStorageService],
  exports: [GeminiService, ResearchStorageService],
})
export class GeminiModule {}

