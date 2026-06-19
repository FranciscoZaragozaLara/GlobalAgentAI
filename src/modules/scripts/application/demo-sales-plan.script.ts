import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';

@Injectable()
export class DemoSalesPlanScript extends BaseScript {
  private readonly logger = new Logger(DemoSalesPlanScript.name);
  readonly name = 'demo-sales-plan';
  readonly description = 'Script de prueba que genera un PDF dummy y lo envía por correo electrónico';

  constructor(
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
  ) {
    super();
  }

  async execute(params: Record<string, any>): Promise<ScriptResult> {
    const emailDestination = params.email || 'frzaragoza.arcade@gmail.com';
    const agencyName = params.agencyName || 'Jetour Soueast Dealer Demo';
    const monthName = params.monthName || 'Mes Actual';
    
    this.logger.log(`Starting execute of DemoSalesPlanScript target email: ${emailDestination}`);

    try {
      // 1. Generate PDF
      const pdfBuffer = await this.pdfService.generateDummyPdf(monthName, agencyName);
      this.logger.log('Dummy PDF successfully generated.');

      // 2. Send email
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Plan Estratégico de Ventas - ${monthName}`,
        'hola aqui va el plan de ventas del mes actual',
        pdfBuffer,
        `Plan_Ventas_${monthName.replace(/\s+/g, '_')}.pdf`,
      );

      if (emailSent) {
        return {
          success: true,
          message: `Script executed successfully. Email sent to ${emailDestination} with dynamic PDF.`,
          data: {
            destination: emailDestination,
            agency: agencyName,
            month: monthName,
          },
        };
      } else {
        throw new Error('Email delivery failed in Notifications service');
      }
    } catch (err) {
      this.logger.error(`Error executing script: ${err.message}`, err.stack);
      return {
        success: false,
        message: `Script execution failed: ${err.message}`,
      };
    }
  }
}
