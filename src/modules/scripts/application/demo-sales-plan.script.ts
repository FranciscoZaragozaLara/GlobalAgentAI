import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { AuthService } from '../../auth/application/auth.service';
import { SalesAnalyticsService } from '../../external-data/application/sales-analytics.service';
import { ResearchStorageService } from '../../gemini/application/research-storage.service';

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
    private readonly researchStorageService: ResearchStorageService,
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

      // --- EJECUCIÓN DE DEEP RESEARCH REAL CON CACHÉ ---
      let realDeepResearchMarkdown = '';
      
      if (this.researchStorageService.hasResearch(monthName, queryYear)) {
        this.logger.log(`Deep Research for ${monthName} ${queryYear} found in cache. Loading from disk...`);
        realDeepResearchMarkdown = this.researchStorageService.getResearch(monthName, queryYear);
      } else {
        this.logger.log(`Executing REAL Deep Research using Gemini 2.5 Pro for ${monthName} ${queryYear}...`);
        
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
        realDeepResearchMarkdown = await this.geminiService.generateText(researchPrompt, 'gemini-2.5-pro');
        this.logger.log('Real Deep Research Markdown generated from Gemini.');
        
        // Save to local disk cache
        this.researchStorageService.saveResearch(monthName, queryYear, realDeepResearchMarkdown);
      }

      // --- FASE DE UNIFICACIÓN ESTRATÉGICA CON LLM (Gemini 3.5 Flash) ---
      this.logger.log('Generating Unified Strategic Executive Report with Gemini 3.5 Flash...');
      const unificationPrompt = `
Eres un Consultor Senior de Estrategia Comercial Automotriz para la marca Jetour & Soueast en México.

Tu objetivo es tomar los datos cuantitativos de ventas y objetivos históricos (obtenidos de las APIs de la empresa) y combinarlos inteligentemente con las tendencias de mercado del reporte de Deep Research cualitativo. Debes producir un único **Reporte Ejecutivo y Plan de Trabajo Estratégico Unificado** que de sentido a los números utilizando el contexto del mercado.

DATOS CUANTITATIVOS DE VENTAS Y METAS (.NET API):
${JSON.stringify(metrics, null, 2)}

REPORTE DEEP RESEARCH CUALITATIVO DE MERCADO:
${realDeepResearchMarkdown}

INSTRUCCIONES DE REDACCIÓN Y COHESIÓN CRÍTICAS:
1. **FUSIONA LOS DATOS CON LA ESTRATEGIA:** Enlaza y justifica la meta de ventas sugerida de cada modelo (ej. Jetour X70, Dashing, etc.) directamente con las temporalidades de campaña y tendencias cualitativas descritas en el Deep Research.
2. **PLANTEA TAREAS COMERCIALES PUNTUALES:** Define una lista de tareas de negocio y marketing sumamente específicas y accionables para el equipo comercial, ligando metas y desempeños YoY.
3. **SECCIÓN EXCLUSIVA DE CAMPAÑAS DE MARKETING:**
   Debes incluir obligatoriamente una sección titulada exactamente \`## Propuestas de Campañas de Marketing\`.
   Dentro de esta sección, debes estructurar propuestas comerciales específicas para los próximos 3 meses, iniciando en el mes actual del periodo (Junio 2026). Debes incluir:
   - Segmentación clara con subtítulos de nivel 3 (\`### Junio 2026\`, \`### Julio 2026\`, \`### Agosto 2026\`).
   - Exactamente 3 campañas promocionales creativas para cada mes.
   - Para cada campaña, incluye:
     * **Concepto y Explicación:** Justificación estratégica del anuncio ligado a los modelos Jetour/Soueast.
     * **Copys y Medios de Ads:** Texto publicitario completo listo para publicar en redes sociales o pauta digital (incluyendo hashtags relevantes).
     * **Prompt de Imagen:** El prompt en inglés detallado y listo para copiar en un modelo de generación de imágenes (como Imagen 3, Midjourney, etc.) para crear el arte publicitario asociado.
4. **FORMATO Y ESTRUCTURA (RESTRICCIONES IMPORTANTES):**
   - **PROHIBIDO EL USO DE TABLAS MARKDOWN:** No utilices caracteres como '|' o '-' para armar tablas. La tabla de métricas ya se dibuja de forma automatizada por el sistema. Todo el reporte debe redactarse exclusivamente en párrafos y viñetas simples (-).
   - **NO UTILICES FORMATOS DE NEGRITAS MARKDOWN:** Evita envolver palabras en asteriscos '**', ya que el PDF se encargará de formatear los encabezados de forma limpia.
   - Utiliza exclusivamente subtítulos lógicos de segundo y tercer nivel (## y ###), viñetas simples (-) y párrafos tradicionales.
5. **TONO Y COMIENZO:** Mantén un tono formal, estratégico e imperativo en las tareas. Inicia directamente con el texto del reporte, sin saludos ni introducciones previas.
      `;

      const unifiedStrategyMarkdown = await this.geminiService.generateText(unificationPrompt, 'gemini-3.5-flash');
      this.logger.log('Unified Strategy Markdown successfully generated by Gemini 3.5 Flash.');

      // --- GENERAR REPORTE EJECUTIVO PDF UNIFICADO Y ENVIAR UN CORREO ÚNICO ---
      this.logger.log('Generating unified executive PDF report (cover, tables, vector charts, unified strategy)...');
      const pdfBuffer = await this.pdfService.generateExecutivePdf(
        monthName,
        agencyName,
        metrics,
        unifiedStrategyMarkdown,
      );
      this.logger.log('Executive PDF successfully generated.');

      // Build concise 2-paragraph email body
      const emailBodyText = `Estimado Director,

Adjuntamos el Plan Estratégico de Ventas y Marketing correspondiente al periodo de ${monthName} de 2026. Este reporte unifica el análisis cuantitativo de ventas históricas, las proyecciones de objetivos sugeridos por modelo y la investigación estratégica de tendencias de mercado (Deep Research) para impulsar el desempeño comercial de la marca Jetour y Soueast en México.

El objetivo de ventas global recomendado para este periodo se establece en ${metrics.totals.suggestedGoal2026} unidades, lo que representa una tendencia de crecimiento anual acumulada del ${metrics.totals.growthRate}% en el trimestre de comparación. La justificación de metas individuales por modelo y las tácticas específicas de campañas de temporada y rotación de unidades seminuevas (Trade-in) se detallan a profundidad en el documento ejecutivo PDF anexo a este mensaje.`;

      this.logger.log(`Sending unified Strategic Sales Plan email to ${emailDestination}...`);
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Plan Estratégico de Ventas y Marketing - ${monthName} 2026`,
        emailBodyText,
        pdfBuffer,
        `Plan_Estrategico_Ventas_${monthName.replace(/\s+/g, '_')}_2026.pdf`,
      );

      if (emailSent) {
        return {
          success: true,
          message: `Script executed successfully. Unified executive PDF report emailed to ${emailDestination}.`,
          data: {
            destination: emailDestination,
            agency: agencyName,
            month: monthName,
            totals: metrics.totals,
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
