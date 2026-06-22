import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { AuthService } from '../../auth/application/auth.service';

@Injectable()
export class DemoSalesPlanScript extends BaseScript {
  private readonly logger = new Logger(DemoSalesPlanScript.name);
  readonly name = 'demo-sales-plan';
  readonly description = 'Script de prueba que genera un Deep Research real con Gemini 2.5 Pro y envía el PDF final';

  constructor(
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    private readonly geminiService: GeminiService,
    private readonly authService: AuthService,
  ) {
    super();
  }


  async execute(params: Record<string, any>): Promise<ScriptResult> {
    const emailDestination = params.email || 'frzaragoza.arcade@gmail.com';
    const agencyName = params.agencyName || 'Jetour Soueast Dealer Demo';
    const monthName = params.monthName || 'Mes Actual';
    
    this.logger.log(`Starting execute of DemoSalesPlanScript target email: ${emailDestination}`);

    try {
      // --- PASO DE AUTENTICACIÓN A PRUEBA ---
      this.logger.log('Validating Global DMS authentication credentials...');
      const token = await this.authService.getValidToken();
      this.logger.log(`Authentication successful. Token retrieved (length: ${token.length}).`);

      // --- EJECUCIÓN DE DEEP RESEARCH REAL CON GEMINI 2.5 PRO ---

      this.logger.log('Executing REAL Deep Research using Gemini 2.5 Pro...');
      
      const researchPrompt = `
Eres un Consultor Senior de Estrategia de Negocios y Marketing Digital, experto en el mercado automotriz mexicano y especializado en el segmento de SUVs y vehículos de origen asiático. 

Tu objetivo es realizar una investigación de mercado profunda y generar un Plan Estratégico Mensual (Deep Research) para la marca de automóviles Jetour y Soueast en México, correspondiente al periodo de: ${monthName} de 2026.

Esta marca tiene menos de 2 años en el mercado y muchas de sus más de 30 agencias son nuevas y apenas comienzan a operar.

Instrucciones de investigación y análisis:
1. **Tendencias del Consumidor en México (Trimestre a futuro):**
   - Identifica y analiza las tendencias macro y microeconómicas que afectarán la compra de vehículos nuevos y seminuevos en los próximos 3 meses en México (ej. tasas de interés, inflación, disponibilidad de inventario).
   - Analiza el interés de búsqueda y tendencias en el segmento de SUVs familiares, SUVs compactas y crossovers de origen chino.

2. **Temporalidades, Fechas Especiales y Campañas de Moda:**
   - Detalla las fechas comerciales, festividades, eventos de la industria o hitos culturales que ocurrirán en los próximos 3 meses en México (ej. Buen Fin, Regreso a Clases, Hot Sale, Fiestas Patrias, Vacaciones, etc., según corresponda a ${monthName}).
   - Propón conceptos de campañas promocionales disruptivas y de moda que las agencias puedan adaptar localmente.

3. **Estrategia y Conceptos de Venta (Nuevos vs. Seminuevos):**
   - Define tácticas específicas para impulsar la venta de la gama Jetour-Soueast (enfocándote en su propuesta de valor: tecnología, espacio, diseño y garantía competitiva).
   - Desarrolla una estrategia para captación y rotación de autos Seminuevos bajo el esquema "Trade-in" (toma a cuenta de vehículo usado para comprar un Jetour/Soueast nuevo).

Genera tu respuesta en formato Markdown estructurado exactamente con las siguientes secciones:
# 🔍 REPORTE DE DEEP RESEARCH AUTOMOTRIZ - ${monthName} 2026
## 1. ANÁLISIS DE TENDENCIAS MACRO Y MERCADO AUTOMOTRIZ EN MÉXICO
## 2. CALENDARIO DE TEMPORALIDADES Y CAMPAÑAS RECOMENDADAS (PRÓXIMOS 3 MESES)
## 3. PROPUESTA DE CAMPAÑA CORE MENSUAL Y COPYS SUGERIDOS
## 4. TÁCTICAS DE RETENCIÓN, CAPTACIÓN Y ESTRATEGIA DE SEMINUEVOS (TRADE-IN)
## 5. RIESGOS CLAVE DETECTADOS Y MITIGACIONES SUGERIDAS

Mantén un tono profesional, estratégico, altamente detallado y accionado por datos. No uses generalidades; ofrece ideas prácticas y conceptos creativos de campañas listos para ser implementados por las agencias.
      `;

      // Call Gemini 2.5 Pro (Using default model parameter)
      const realDeepResearchMarkdown = await this.geminiService.generateText(researchPrompt, 'gemini-2.5-pro');
      this.logger.log('Real Deep Research Markdown generated from Gemini.');

      // Enviar el reporte Markdown real por correo
      this.logger.log(`Sending Real Deep Research Markdown email to ${emailDestination}...`);
      await this.emailService.sendMailWithAttachment(
        emailDestination,
        `[REVISIÓN DEEP RESEARCH REAL] Propuesta de Estructura - ${monthName}`,
        `Hola,\n\nAdjuntamos la propuesta de Deep Research REAL generada por Gemini 2.5 Pro para ${monthName} para su revisión previa a la persistencia.\n\nContenido del reporte:\n\n${realDeepResearchMarkdown}`,
        Buffer.from(realDeepResearchMarkdown, 'utf-8'),
        `Deep_Research_Real_${monthName.replace(/\s+/g, '_')}.txt`,
      );
      this.logger.log('Real Deep Research draft email successfully sent.');
      // ------------------------------------------------


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
          message: `Script executed successfully. Deep Research draft & final Plan emails sent to ${emailDestination}.`,
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
