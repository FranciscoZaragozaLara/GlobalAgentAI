import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { AuthService } from '../../auth/application/auth.service';
import { SalesAnalyticsService } from '../../external-data/application/sales-analytics.service';

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
    private readonly salesAnalyticsService: SalesAnalyticsService,
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

      // --- PASO DE CÁLCULO DE TENDENCIAS Y MÉTRICAS HISTÓRICAS ---
      this.logger.log('Fetching and calculating historical sales trends YoY...');
      // Month parameter maps from parameter or defaults to 6 (June)
      const queryMonth = params.monthName && params.monthName.toLowerCase().includes('julio') ? 7 : 6;
      const queryYear = 2026;
      const metrics = await this.salesAnalyticsService.generateStrategyMetrics(queryYear, queryMonth);
      this.logger.log('Strategy comparison data and recommended targets calculated.');

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

      // --- GENERAR CORREO DE ANÁLISIS COMPARATIVO DE VENTAS Y OBJETIVOS ---
      this.logger.log('Building historical comparison email content...');
      
      let tableRows = '';
      metrics.comparison.forEach(item => {
        tableRows += `
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 10px; font-weight: bold;">${item.model}</td>
            <td style="padding: 10px; text-align: center; color: #4A5568;">${item.sales3Months2026}</td>
            <td style="padding: 10px; text-align: center; color: #4A5568;">${item.sales3Months2025}</td>
            <td style="padding: 10px; text-align: center; color: ${item.growthRate >= 0 ? '#48BB78' : '#F56565'}; font-weight: bold;">${item.growthRate}%</td>
            <td style="padding: 10px; text-align: center; color: #4A5568;">${item.june2025}</td>
            <td style="padding: 10px; text-align: center; color: #2B6CB0; font-weight: bold; font-size: 1.1em; background-color: #EBF8FF;">${item.suggestedGoal2026}</td>
          </tr>
        `;
      });

      const emailHtmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; color: #2D3748; line-height: 1.6;">
          <h2 style="color: #1A365D; border-bottom: 2px solid #2B6CB0; padding-bottom: 10px;">📊 Reporte Comparativo e Indicadores de Ventas — Jetour Soueast México</h2>
          <p>Estimado Director,</p>
          <p>Presentamos la tabla de análisis comparativo de desempeño de ventas acumuladas correspondientes al periodo trimestre inmediato anterior del año en curso contra el año anterior (YoY), el mes equivalente histórico de 2025 y las metas del objetivo sugeridas para el presente mes.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 0.9em; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
            <thead>
              <tr style="background-color: #2B6CB0; color: white; text-align: left;">
                <th style="padding: 12px; font-weight: 600;">Modelo</th>
                <th style="padding: 12px; font-weight: 600; text-align: center;">Últimos 3 Meses 2026<br>(Mar, Abr, May)</th>
                <th style="padding: 12px; font-weight: 600; text-align: center;">Mismos 3 Meses 2025<br>(Mar, Abr, May)</th>
                <th style="padding: 12px; font-weight: 600; text-align: center;">Tendencia YoY</th>
                <th style="padding: 12px; font-weight: 600; text-align: center;">Mes Eq. Año Ant.<br>(Junio 2025)</th>
                <th style="padding: 12px; font-weight: 600; text-align: center; background-color: #1A365D;">Objetivo Sugerido<br>Junio 2026</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
              <tr style="background-color: #EDF2F7; font-weight: bold; border-top: 2px solid #CBD5E0;">
                <td style="padding: 12px;">TOTAL MARCA</td>
                <td style="padding: 12px; text-align: center;">${metrics.totals.sales3Months2026}</td>
                <td style="padding: 12px; text-align: center;">${metrics.totals.sales3Months2025}</td>
                <td style="padding: 12px; text-align: center; color: ${metrics.totals.growthRate >= 0 ? '#48BB78' : '#F56565'};">${metrics.totals.growthRate}%</td>
                <td style="padding: 12px; text-align: center;">${metrics.totals.june2025}</td>
                <td style="padding: 12px; text-align: center; background-color: #E2E8F0; color: #1A365D; font-size: 1.15em;">${metrics.totals.suggestedGoal2026}</td>
              </tr>
            </tbody>
          </table>

          <div style="background-color: #F7FAFC; border-left: 4px solid #4B5563; padding: 15px; margin: 25px 0; border-radius: 4px;">
            <h4 style="margin-top: 0; color: #1A365D; font-size: 1.1em;">💡 Resumen y Explicación de Metodología de Objetivos:</h4>
            <ul>
              <li><strong>Tendencia YoY:</strong> Muestra la variación de ventas del trimestre acumulado (Mar-Abr-May) en 2026 contra el mismo periodo del año pasado (2025).</li>
              <li><strong>Modelo de Proyección:</strong> El objetivo para Junio 2026 calcula la venta del mes de Junio 2025 ajustada por la tasa de crecimiento de la marca, aplicando un piso basado en el promedio mensual del año actual para modelos con comportamiento estable.</li>
              <li><strong>Total Acumulado Marca:</strong> El objetivo total recomendado se establece en <strong>${metrics.totals.suggestedGoal2026} unidades</strong> para el corporativo nacional, impulsando un crecimiento del <strong>${metrics.totals.growthRate}%</strong> de forma global de acuerdo a la tracción del mercado de SUVs.</li>
            </ul>
          </div>
          <p>En el siguiente paso, utilizaremos estos números estructurados para inyectarlos en la propuesta de Plan de Trabajo detallado e integrarlo al Deep Research para la entrega del PDF corporativo.</p>
        </div>
      `;

      // Enviar el correo comparativo
      this.logger.log(`Sending Historical Sales Analytics email to ${emailDestination}...`);
      await this.emailService.sendMailWithAttachment(
        emailDestination,
        `📊 Reporte Comparativo e Indicadores de Ventas — ${monthName}`,
        'Adjuntamos el reporte estratégico de comparación histórica de ventas para su revisión.',
        Buffer.from(emailHtmlContent, 'utf-8'),
        `Ventas_Comparativo_${monthName.replace(/\s+/g, '_')}.html`,
      );
      this.logger.log('Historical comparison email successfully sent.');
      // ------------------------------------------------
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
