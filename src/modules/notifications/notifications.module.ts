import { Module } from '@nestjs/common';
import { PdfService } from './application/pdf.service';
import { EmailService } from './application/email.service';
import { PptxService } from './application/pptx.service';
import { PodcastService } from './application/podcast.service';
import { GeminiModule } from '../gemini/gemini.module';

@Module({
  imports: [GeminiModule],
  providers: [PdfService, EmailService, PptxService, PodcastService],
  exports: [PdfService, EmailService, PptxService, PodcastService],
})
export class NotificationsModule {}
