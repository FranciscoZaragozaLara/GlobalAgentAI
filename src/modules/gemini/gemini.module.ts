import { Module } from '@nestjs/common';
import { GeminiService } from './application/gemini.service';
import { ResearchStorageService } from './application/research-storage.service';
import { S3Service } from './application/s3.service';
import { PromptTemplateService } from './application/prompt-template.service';
import { PromptTemplateController } from './interfaces/prompt-template.controller';

@Module({
  controllers: [PromptTemplateController],
  providers: [GeminiService, ResearchStorageService, S3Service, PromptTemplateService],
  exports: [GeminiService, ResearchStorageService, S3Service, PromptTemplateService],
})
export class GeminiModule {}

