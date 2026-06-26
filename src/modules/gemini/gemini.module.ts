import { Module } from '@nestjs/common';
import { GeminiService } from './application/gemini.service';
import { ResearchStorageService } from './application/research-storage.service';
import { S3Service } from './application/s3.service';

@Module({
  providers: [GeminiService, ResearchStorageService, S3Service],
  exports: [GeminiService, ResearchStorageService, S3Service],
})
export class GeminiModule {}

