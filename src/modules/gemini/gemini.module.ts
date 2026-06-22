import { Module } from '@nestjs/common';
import { GeminiService } from './application/gemini.service';

@Module({
  providers: [GeminiService],
  exports: [GeminiService],
})
export class GeminiModule {}
