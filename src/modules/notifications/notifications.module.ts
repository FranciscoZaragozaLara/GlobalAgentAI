import { Module } from '@nestjs/common';
import { PdfService } from './application/pdf.service';
import { EmailService } from './application/email.service';

@Module({
  providers: [PdfService, EmailService],
  exports: [PdfService, EmailService],
})
export class NotificationsModule {}
