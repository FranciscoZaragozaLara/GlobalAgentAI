import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendMailWithAttachment(
    to: string,
    subject: string,
    text: string,
    pdfBuffer?: Buffer,
    pdfFilename?: string,
    html?: string,
  ): Promise<boolean> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY');
    const fromEmail = this.configService.get<string>('SMTP_FROM', 'no-reply@jetour-soueast.mx');

    if (!apiKey) {
      this.logger.error('BREVO_API_KEY is not defined in the environment variables.');
      return false;
    }

    try {
      // Brevo Transactional Email V3 endpoint
      const url = 'https://api.brevo.com/v3/smtp/email';

      const payload: any = {
        sender: {
          name: 'Jetour Soueast México',
          email: fromEmail,
        },
        to: [
          {
            email: to,
          },
        ],
        subject: subject,
        textContent: text,
        htmlContent: html || `<p>${text.replace(/\n/g, '<br>')}</p>`,
      };

      if (pdfBuffer && pdfFilename) {
        // Convert PDF Buffer to Base64 (Required by Brevo API)
        const base64Content = pdfBuffer.toString('base64');
        payload.attachment = [
          {
            content: base64Content,
            name: pdfFilename,
          },
        ];
      }

      this.logger.log(`Sending transactional email via Brevo API to ${to}...`);

      const response = await axios.post(url, payload, {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.status === 201 || response.status === 200) {
        this.logger.log(`Email successfully sent via Brevo. Message ID: ${response.data.messageId}`);
        return true;
      }

      this.logger.warn(`Brevo returned unexpected status code: ${response.status}`);
      return false;
    } catch (error) {
      if (error.response) {
        this.logger.error(
          `Brevo API error (${error.response.status}): ${JSON.stringify(error.response.data)}`,
        );
      } else {
        this.logger.error(`Error connecting to Brevo API: ${error.message}`);
      }
      return false;
    }
  }
}
