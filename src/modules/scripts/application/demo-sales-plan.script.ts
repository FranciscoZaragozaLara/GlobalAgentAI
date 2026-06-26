import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { AuthService } from '../../auth/application/auth.service';
import { SalesAnalyticsService } from '../../external-data/application/sales-analytics.service';
import { ResearchStorageService } from '../../gemini/application/research-storage.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

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
    const researchMode = params.researchMode || 'Basica';
    const reportMode = params.reportMode || 'Triple';
    
    this.logger.log(`Starting execute of DemoSalesPlanScript in mode [Research: ${researchMode} | Report: ${reportMode}] target email: ${emailDestination}`);
    try {
      // --- PASO DE AUTENTICACIÓN A PRUEBA ---
      this.logger.log('Validating Global DMS authentication credentials...');
      const token = await this.authService.getValidToken();
      this.logger.log(`Authentication successful. Token retrieved (length: ${token.length}).`);

      // --- PASO DE CÁLCULO DE TENDENCIAS Y MÉTRICAS HISTÓRICAS ---
      this.logger.log('Fetching and calculating historical sales trends YoY...');
      // Month parameter maps from parameter or defaults to 6 (June)
      let queryMonth = 6;
      if (monthName) {
        const lowerMonth = monthName.toLowerCase();
        if (lowerMonth.includes('julio')) queryMonth = 7;
        else if (lowerMonth.includes('abril')) queryMonth = 4;
        else if (lowerMonth.includes('junio')) queryMonth = 6;
      }
      const queryYear = 2026;
      const metrics = await this.salesAnalyticsService.generateStrategyMetrics(queryYear, queryMonth);
      this.logger.log('Strategy comparison data and recommended targets calculated.');

      // Share researchPrompt across both Single and Triple flows
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

      // --- FLOW A: SINGLE DEEP RESEARCH ONLY ---
      if (reportMode === 'Single') {
        let researchMd = '';
        let cacheHit = 'NONE';
        
        if (await this.researchStorageService.hasResearch(monthName, queryYear, researchMode)) {
          this.logger.log(`Deep Research found in cache (Nivel 1 HIT) for ${monthName} ${queryYear} (${researchMode}). Loading...`);
          researchMd = await this.researchStorageService.getResearch(monthName, queryYear, researchMode);
          cacheHit = 'RESEARCH_NIVEL_1';
        } else {
          this.logger.log(`Executing REAL Deep Research (Nivel 1 MISS) using mode: ${researchMode}...`);
          researchMd = await this.geminiService.generateDeepResearch(researchPrompt, researchMode);
          await this.researchStorageService.saveResearch(monthName, queryYear, researchMd, researchMode);
        }

        const additionalAttachments = [
          {
            content: Buffer.from(researchMd, 'utf-8'),
            name: `Investigacion_Mercado_Deep_Research_${researchMode}_${monthName.replace(/\s+/g, '_')}_2026.txt`,
          }
        ];

        const emailBodyText = `Estimado Director,

Adjuntamos el reporte de investigación cualitativa de mercado (Deep Research) correspondiente al periodo de ${monthName} de 2026, generado bajo la modalidad: ${researchMode}.

Este documento detalla las tendencias del consumidor, temporalidades y tácticas de venta sugeridas para el periodo comercial de referencia.`;

        this.logger.log(`Sending Single Deep Research email to ${emailDestination}...`);
        const emailSent = await this.emailService.sendMailWithAttachment(
          emailDestination,
          `Investigación de Mercado Deep Research (${researchMode}) - ${monthName} 2026`,
          emailBodyText,
          undefined,
          undefined,
          undefined,
          additionalAttachments,
        );

        if (emailSent) {
          return {
            success: true,
            message: `Script executed successfully. Deep Research (${researchMode}) report emailed to ${emailDestination}.`,
            data: {
              destination: emailDestination,
              month: monthName,
              researchMode,
              reportMode,
              cacheHit,
            },
          };
        } else {
          throw new Error('Email delivery failed in Notifications service');
        }
      }

      // --- FLOW B: TRIPLE REPORT FLOW (MAIN PDF, DEEP RESEARCH, CAMPAIGN IMAGES CATALOG) ---

      // --- COMPROBAR NIVEL 4: FINAL EXECUTIVE PDF CACHE ---
      if (await this.researchStorageService.hasPdfReport(monthName, queryYear, agencyName, researchMode)) {
        this.logger.log(`Final PDF Report for ${agencyName} (${monthName} ${queryYear}) found in cache (Nivel 4 HIT). Loading from disk...`);
        const pdfBuffer = await this.researchStorageService.getPdfReport(monthName, queryYear, agencyName, researchMode);

        // Get research markdown for attachment 1
        const researchMd = (await this.researchStorageService.hasResearch(monthName, queryYear, researchMode))
          ? await this.researchStorageService.getResearch(monthName, queryYear, researchMode)
          : 'Reporte de Deep Research no disponible en caché.';

        // Get unified report to extract image catalog and generate images PDF for attachment 3
        let imagesPdfBuffer: Buffer | undefined;
        if (await this.researchStorageService.hasUnifiedReport(monthName, queryYear, agencyName, researchMode)) {
          const unifiedReport = await this.researchStorageService.getUnifiedReport(monthName, queryYear, agencyName, researchMode);
          const catalog = this.extractImagesCatalog(unifiedReport);
          try {
            imagesPdfBuffer = await this.pdfService.generateCampaignImagesPdf(monthName, agencyName, catalog);
          } catch (pdfErr) {
            this.logger.error(`Error generating cached images PDF: ${pdfErr.message}`);
          }
        }

        const additionalAttachments: Array<{ content: Buffer; name: string }> = [
          {
            content: Buffer.from(researchMd, 'utf-8'),
            name: `Investigacion_Mercado_Deep_Research_${researchMode}_${monthName.replace(/\s+/g, '_')}_2026.txt`,
          }
        ];

        if (imagesPdfBuffer) {
          additionalAttachments.push({
            content: imagesPdfBuffer,
            name: `Catalogo_Imagenes_Campanas_${monthName.replace(/\s+/g, '_')}_2026.pdf`,
          });
        }

        const emailBodyText = `Estimado Director,

Adjuntamos el Plan Estratégico de Ventas y Marketing correspondiente al periodo de ${monthName} de 2026. Este reporte unifica el análisis cuantitativo de ventas históricas, las proyecciones de objetivos sugeridos por modelo y la investigación estratégica de tendencias de mercado (Deep Research) para impulsar el desempeño comercial de la marca Jetour y Soueast en México.

El objetivo de ventas global recomendado para este periodo se establece en ${metrics.totals.suggestedGoal2026} unidades, lo que representa una tendencia de crecimiento anual acumulada del ${metrics.totals.growthRate}% en el trimestre de comparación. La justificación de metas individuales por modelo y las tácticas específicas de campañas de temporada y rotación de unidades seminuevas (Trade-in) se detallan a profundidad en el documento ejecutivo PDF anexo a este mensaje.`;

        this.logger.log(`Sending cached unified Strategic Sales Plan email with 3 attachments to ${emailDestination}...`);
        const emailSent = await this.emailService.sendMailWithAttachment(
          emailDestination,
          `Plan Estratégico de Ventas - ${monthName} 2026 (Caché)`,
          emailBodyText,
          pdfBuffer,
          `Plan_Estrategico_Ventas_${researchMode}_${monthName.replace(/\s+/g, '_')}_2026.pdf`,
          undefined,
          additionalAttachments,
        );

        if (emailSent) {
          return {
            success: true,
            message: `Script executed successfully (CACHE HIT - PDF). Cached executive PDF report emailed to ${emailDestination}.`,
            data: {
              destination: emailDestination,
              agency: agencyName,
              month: monthName,
              totals: metrics.totals,
              cacheHit: 'PDF_REPORT_NIVEL_4'
            },
          };
        } else {
          throw new Error('Email delivery failed in Notifications service');
        }
      }

      // --- COMPROBAR NIVEL 2: REPORTE UNIFICADO CACHE ---
      let unifiedStrategyMarkdown = '';
      let fromUnifiedCache = false;
      let realDeepResearchMarkdown = '';

      if (await this.researchStorageService.hasResearch(monthName, queryYear, researchMode)) {
        realDeepResearchMarkdown = await this.researchStorageService.getResearch(monthName, queryYear, researchMode);
      }

      if (await this.researchStorageService.hasUnifiedReport(monthName, queryYear, agencyName, researchMode)) {
        this.logger.log(`Unified Strategy Report Markdown for ${agencyName} (${monthName} ${queryYear}) found in cache (Nivel 2 HIT). Loading...`);
        unifiedStrategyMarkdown = await this.researchStorageService.getUnifiedReport(monthName, queryYear, agencyName, researchMode);
        fromUnifiedCache = true;
      } else {
        // --- EJECUCIÓN DE DEEP RESEARCH REAL CON CACHÉ (NIVEL 1) ---
        if (realDeepResearchMarkdown) {
          this.logger.log(`Deep Research for ${monthName} ${queryYear} found in cache (Nivel 1 HIT). Loaded from disk.`);
        } else {
          this.logger.log(`Executing REAL Deep Research using Gemini 2.5 Pro for ${monthName} ${queryYear} (Nivel 1 MISS)...`);
          realDeepResearchMarkdown = await this.geminiService.generateDeepResearch(researchPrompt, researchMode);
          this.logger.log(`Real Deep Research Markdown generated from Gemini using mode: ${researchMode}.`);
          
          // Save to local disk cache with researchMode
          await this.researchStorageService.saveResearch(monthName, queryYear, realDeepResearchMarkdown, researchMode);
        }

        const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const monthIdx = monthsEs.findIndex(m => m.toLowerCase().includes(monthName.toLowerCase()));
        
        let m1 = 'Junio 2026';
        let m2 = 'Julio 2026';
        let m3 = 'Agosto 2026';
        
        if (monthIdx !== -1) {
          m1 = `${monthsEs[monthIdx]} 2026`;
          m2 = `${monthsEs[(monthIdx + 1) % 12]} 2026`;
          m3 = `${monthsEs[(monthIdx + 2) % 12]} 2026`;
        }

        // --- FASE DE UNIFICACIÓN ESTRATÉGICA CON LLM (Gemini 3.5 Flash) (NIVEL 2 MISS) ---
        this.logger.log('Generating Unified Strategic Executive Report with Gemini 3.5 Flash...');
        const unificationPrompt = `
Eres un Consultor Senior de Estrategia Comercial Automotriz para la marca Jetour & Soueast en México.

Tu objetivo es tomar los datos cuantitativos de ventas y objetivos históricos (obtenidos de las APIs de la empresa) y combinarlos inteligentemente con las tendencias de mercado del reporte de Deep Research cualitativo. Debes producir un único **Reporte Ejecutivo y Plan de Trabajo Estratégico Unificado** que de sentido a los números utilizando el contexto del mercado.

DATOS CUANTITATIVOS DE VENTAS Y METAS (.NET API):
${JSON.stringify(metrics, null, 2)}

REPORTE DEEP RESEARCH CUALITATIVO DE MERCADO:
${realDeepResearchMarkdown}

INSTRUCCIONES DE REDACCIÓN E IMPERATIVAS:
1. **FUSIONA LOS DATOS CON LA ESTRATEGIA:** Enlaza y justifica la meta de ventas sugerida de cada modelo (ej. Jetour X70, Dashing, etc.) directamente con las temporalidades de campaña y tendencias cualitativas descritas en el Deep Research.
2. **PLANTEA TAREAS COMERCIALES PUNTUALES:** Define una lista de tareas de negocio y marketing sumamente específicas y accionables para el equipo comercial, ligando metas y desempeños YoY.
3. **SECCIÓN EXCLUSIVA DE CAMPAÑAS DE MARKETING:**
   Debes incluir obligatoriamente una sección titulada exactamente \`## Propuestas de Campañas de Marketing\`.
   Dentro de esta sección, debes estructurar propuestas comerciales específicas para los próximos 3 meses, iniciando en el mes actual del periodo (${m1}). Debes incluir:
   - Segmentación clara con subtítulos de nivel 3 (\`### ${m1}\`, \`### ${m2}\`, \`### ${m3}\`).
   - Exactamente 3 campañas promocionales creativas para cada mes.
   - **REGLA DE CAMPAÑA TRIMESTRAL DE G700:** Al menos una de las 9 campañas del trimestre (a lo largo de los 3 meses) DEBE estar dedicada a promover el nuevo modelo **Jetour G700** que se acaba de lanzar.
   - Para cada campaña, incluye:
     * **Concepto y Explicación:** Justificación estratégica del anuncio ligado a los modelos Jetour/Soueast.
     * **Copys y Medios de Ads:** Texto publicitario completo listo para publicar en redes sociales o pauta digital (incluyendo hashtags relevantes).
     * **Prompt de Imagen:** El prompt en inglés detallado para la generación de la imagen publicitaria de la campaña. Escribe en este formato exacto: [PROMPT: write the detailed English prompt here].
       REGLAS CRÍTICAS PARA EL PROMPT DE IMAGEN:
       - El prompt DEBE mencionar el modelo específico de vehículo Jetour/Soueast que se promueve (ej. Dashing, S07, T2, G700).
       - Como el modelo generador de imágenes puede no conocer el diseño exacto por su nombre, DEBES incluir en el prompt una breve descripción física y visual del automóvil basada en las siguientes guías:
         * **Jetour Dashing:** "Jetour Dashing, a sleek, sporty and modern compact crossover SUV, featuring a futuristic split-grille front, flush pop-out door handles, sharp dynamic LED headlights, and a sporty rear spoiler"
         * **Soueast S07** / **Jetour S07**: "Soueast S07, a modern, elegant mid-size family SUV, with a cascading chrome front grille, horizontal panoramic LED rear taillight bar, and a premium panoramic sunroof"
         * **Jetour T2**: "Jetour T2, a rugged, boxy off-road SUV, with a bold horizontal front grid with illuminated letters, high ground clearance, squared-off wheel arches, and a rear-mounted square spare tire carrier"
         * **Jetour G700**: "Jetour G700, a premium luxury full-size SUV, featuring imposing geometric lines, a heavy horizontal chrome front grille, futuristic vertical and horizontal LED headlight clusters, large luxury multispoke alloy wheels, and a premium presence"
       - El prompt de la imagen DEBE contextualizarse a un público objetivo de clase media y media-alta de México.
       - Las locaciones deben sugerir entornos mexicanos típicos de nivel medio-alto (calles residenciales modernas en México, casas contemporáneas, etc.).
       - Las personas mostradas deben tener rasgos y apariencia latinoamericana/mexicana típica.
       - PROHIBIDO incluir o hacer referencia a personas de rasgos asiáticos/orientales, letras o caracteres chinos/asiáticos, o edificios con letreros chinos en el prompt. Escribe explícitamente en el prompt la exclusión de elementos asiáticos (ej. "no Asian elements, no Chinese text, no oriental features").
4. **FORMATO Y ESTRUCTURA (RESTRICCIONES IMPORTANTES):**
   - **PROHIBIDO EL USO DE TABLAS MARKDOWN:** No utilices caracteres como '|' o '-' para armar tablas. La tabla de métricas ya se dibuja de forma automatizada por el sistema. Todo el reporte debe redactarse exclusivamente en párrafos y viñetas simples (-).
   - **NO UTILICES FORMATOS DE NEGRITAS MARKDOWN:** Evita envolver palabras en asteriscos '**', ya que el PDF se encargará de formatear los encabezados de forma limpia.
   - Utiliza exclusivamente subtítulos lógicos de segundo y tercer nivel (## y ###), viñetas simples (-) y párrafos tradicionales.
5. **TONO Y COMIENZO:** Mantén un tono formal, estratégico e imperativo en las tareas. Inicia directamente con el texto del reporte, sin saludos ni introducciones previas.
        `;

        unifiedStrategyMarkdown = await this.geminiService.generateText(unificationPrompt, 'gemini-3.5-flash');
        this.logger.log('Unified Strategy Markdown successfully generated by Gemini 3.5 Flash.');

        // Save to Nivel 2 cache
        await this.researchStorageService.saveUnifiedReport(monthName, queryYear, agencyName, unifiedStrategyMarkdown, researchMode);
      }

      // --- FASE DE GENERACIÓN DE IMÁGENES DE ADS Y PORTADA CON CACHÉ (NIVEL 3: IMAGEN 4) ---
      const cacheImagesDir = path.join(process.cwd(), 'data', 'cache', 'images');
      if (!fs.existsSync(cacheImagesDir)) {
        fs.mkdirSync(cacheImagesDir, { recursive: true });
      }

      let anyImageGenerationFailed = false;
      const safetySuffix = ". Styled for Mexican middle-high class families in Mexican settings, typical Mexican people, no Asian elements, no Chinese text, no oriental characters, no Asian people, realistic commercial photography.";

      // A) Generar Banner de Portada Dinámica
      this.logger.log('Generating dynamic cover banner image for report...');
      const bannerPromptText = `A professional, wide-angle banner photo showing the modern showroom of a Jetour and Soueast car dealership in Mexico featuring their latest SUV models in a premium neighborhood during ${monthName} of 2026. The atmosphere is upscale and clean, with local Mexican middle-class buyers exploring the cars. Clean composition, high-end commercial automotive photography style, warm natural sunset lighting, 8k resolution. No Asian text, no Asian characters, and no Asian or oriental people.`;
      
      const bannerHash = crypto.createHash('md5').update(bannerPromptText.trim().toLowerCase()).digest('hex');
      const bannerPath = path.join(cacheImagesDir, `banner_cache_${bannerHash}.jpg`);
      const bannerModelName = 'imagen-4.0-generate-001';
      const bannerFilename = `banner_cache_${bannerHash}.jpg`;
      
      const bannerInfo = {
        path: bannerPath,
        prompt: bannerPromptText,
        model: bannerModelName,
        file: bannerFilename
      };

      if (await this.researchStorageService.hasCampaignImage(`banner_${bannerHash}`)) {
        this.logger.log(`Dynamic cover banner found in S3 (Nivel 3 HIT) (Hash: ${bannerHash}). Downloading...`);
        const bannerBuffer = await this.researchStorageService.getCampaignImage(`banner_${bannerHash}`);
        fs.writeFileSync(bannerPath, bannerBuffer);
      } else {
        this.logger.log(`Generating dynamic cover banner (Nivel 3 MISS)...`);
        try {
          const bannerBuffer = await this.geminiService.generateImage(bannerPromptText + safetySuffix, bannerModelName);
          fs.writeFileSync(bannerPath, bannerBuffer);
          await this.researchStorageService.saveCampaignImage(`banner_${bannerHash}`, bannerBuffer);
          this.logger.log(`Dynamic cover banner generated and saved to cache/S3.`);
        } catch (bannerErr) {
          this.logger.error(`Error generating dynamic cover banner: ${bannerErr.message}`);
          anyImageGenerationFailed = true;
        }
      }

      // B) Generar imágenes de anuncios de la campaña
      this.logger.log('Extracting ads image prompts and resolving via local MD5 cache...');
      // Match [PROMPT: ...] tags
      const promptRegex = /\[PROMPT:\s*(.*?)\]/gi;
      const matches = [...unifiedStrategyMarkdown.matchAll(promptRegex)];
      this.logger.log(`Found ${matches.length} campaign ads images to process.`);

      // Process images sequentially
      let modifiedMarkdown = unifiedStrategyMarkdown;
      for (let i = 0; i < matches.length; i++) {
        const [originalTag, promptText] = matches[i];
        
        // Generate MD5 hash of the prompt text to uniquely identify the image contents
        const promptHash = crypto.createHash('md5').update(promptText.trim().toLowerCase()).digest('hex');
        const cachedImagePath = path.join(cacheImagesDir, `ad_cache_${promptHash}.jpg`);

        const filename = `ad_cache_${promptHash}.jpg`;
        const modelName = 'imagen-4.0-generate-001';
        const imageTag = `[IMAGE_DATA|path:${cachedImagePath}|prompt:${promptText}|model:${modelName}|file:${filename}]`;

        if (await this.researchStorageService.hasCampaignImage(promptHash)) {
          this.logger.log(`Ad image ${i + 1}/${matches.length} found in S3 (Nivel 3 HIT) (Hash: ${promptHash}). Downloading...`);
          const imageBuffer = await this.researchStorageService.getCampaignImage(promptHash);
          fs.writeFileSync(cachedImagePath, imageBuffer);
          modifiedMarkdown = modifiedMarkdown.replace(originalTag, imageTag);
        } else {
          this.logger.log(`Generating ad image ${i + 1}/${matches.length} (Nivel 3 MISS) with prompt: "${promptText.substring(0, 60)}..."`);
          
          try {
            // Call Google Imagen 4.0 (as verified in ListModels)
            const finalPrompt = promptText + safetySuffix;
            const imageBuffer = await this.geminiService.generateImage(finalPrompt, modelName);
            fs.writeFileSync(cachedImagePath, imageBuffer);
            await this.researchStorageService.saveCampaignImage(promptHash, imageBuffer);
            this.logger.log(`Ad image generated and saved to cache/S3.`);
            
            modifiedMarkdown = modifiedMarkdown.replace(originalTag, imageTag);
          } catch (imgErr) {
            this.logger.error(`Error generating image for campaign ${i + 1}: ${imgErr.message}`);
            modifiedMarkdown = modifiedMarkdown.replace(originalTag, `[Error de Generación: ${imgErr.message}]`);
            anyImageGenerationFailed = true;
          }
        }
      }

      // --- GENERAR REPORTE EJECUTIVO PDF UNIFICADO Y ENVIAR UN CORREO ÚNICO ---
      this.logger.log('Generating unified executive PDF report (cover, tables, vector charts, unified strategy with ads images)...');
      const pdfBuffer = await this.pdfService.generateExecutivePdf(
        monthName,
        agencyName,
        metrics,
        modifiedMarkdown,
        bannerInfo,
      );
      this.logger.log('Executive PDF successfully generated.');

      // Save to Nivel 4 cache ONLY if all images were successfully resolved/generated
      if (!anyImageGenerationFailed) {
        await this.researchStorageService.savePdfReport(monthName, queryYear, agencyName, pdfBuffer, researchMode);
      } else {
        this.logger.warn(`Skipping Nivel 4 PDF Cache write because one or more ad images failed to generate. Next execution will retry.`);
      }

      // Build concise 2-paragraph email body
      const emailBodyText = `Estimado Director,

Adjuntamos el Plan Estratégico de Ventas y Marketing correspondiente al periodo de ${monthName} de 2026. Este reporte unifica el análisis cuantitativo de ventas históricas, las proyecciones de objetivos sugeridos por modelo y la investigación estratégica de tendencias de mercado (Deep Research) para impulsar el desempeño comercial de la marca Jetour y Soueast en México.

El objetivo de ventas global recomendado para este periodo se establece en ${metrics.totals.suggestedGoal2026} unidades, lo que representa una tendencia de crecimiento anual acumulada del ${metrics.totals.growthRate}% en el trimestre de comparación. La justificación de metas individuales por modelo y las tácticas específicas de campañas de temporada y rotación de unidades seminuevas (Trade-in) se detallan a profundidad en el documento ejecutivo PDF anexo a este mensaje.`;

      // Extract images catalog and generate images PDF
      const catalog = this.extractImagesCatalog(modifiedMarkdown);
      let imagesPdfBuffer: Buffer | undefined;
      try {
        imagesPdfBuffer = await this.pdfService.generateCampaignImagesPdf(monthName, agencyName, catalog);
      } catch (pdfErr) {
        this.logger.error(`Error generating campaign images PDF: ${pdfErr.message}`);
      }

      const additionalAttachments: Array<{ content: Buffer; name: string }> = [
        {
          content: Buffer.from(realDeepResearchMarkdown || 'Reporte de Deep Research no disponible.', 'utf-8'),
          name: `Investigacion_Mercado_Deep_Research_${researchMode}_${monthName.replace(/\s+/g, '_')}_2026.txt`,
        }
      ];

      if (imagesPdfBuffer) {
        additionalAttachments.push({
          content: imagesPdfBuffer,
          name: `Catalogo_Imagenes_Campanas_${monthName.replace(/\s+/g, '_')}_2026.pdf`,
        });
      }

      this.logger.log(`Sending unified Strategic Sales Plan email with 3 attachments to ${emailDestination}...`);
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Plan Estratégico de Ventas y Marketing - ${monthName} 2026`,
        emailBodyText,
        pdfBuffer,
        `Plan_Estrategico_Ventas_${researchMode}_${monthName.replace(/\s+/g, '_')}_2026.pdf`,
        undefined,
        additionalAttachments,
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
            cacheHit: fromUnifiedCache ? 'UNIFIED_MD_NIVEL_2' : 'NONE'
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

  private extractImagesCatalog(markdown: string): Array<{ path: string; prompt: string; model: string; filename: string }> {
    const catalog: Array<{ path: string; prompt: string; model: string; filename: string }> = [];
    const cacheImagesDir = path.join(process.cwd(), 'data', 'cache', 'images');
    // Match modified IMAGE_DATA tags
    const imageDataRegex = /\[IMAGE_DATA\|path:(.*?)\|prompt:(.*?)\|model:(.*?)\|file:(.*?)\]/gi;
    const imageDataMatches = [...markdown.matchAll(imageDataRegex)];
    if (imageDataMatches.length > 0) {
      imageDataMatches.forEach((m) => {
        catalog.push({
          path: m[1].trim(),
          prompt: m[2].trim(),
          model: m[3].trim(),
          filename: m[4].trim()
        });
      });
      return catalog;
    }

    // Fallback to match original PROMPT tags
    const promptRegex = /\[PROMPT:\s*(.*?)\]/gi;
    const matches = [...markdown.matchAll(promptRegex)];
    matches.forEach(([_, promptText]) => {
      const promptHash = crypto.createHash('md5').update(promptText.trim().toLowerCase()).digest('hex');
      const cachedImagePath = path.join(cacheImagesDir, `ad_cache_${promptHash}.jpg`);
      catalog.push({
        path: cachedImagePath,
        prompt: promptText.trim(),
        model: 'imagen-4.0-generate-001',
        filename: `ad_cache_${promptHash}.jpg`
      });
    });

    return catalog;
  }
}
