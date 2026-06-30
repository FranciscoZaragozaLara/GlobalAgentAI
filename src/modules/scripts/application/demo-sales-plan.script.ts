import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { AuthService } from '../../auth/application/auth.service';
import { SalesAnalyticsService } from '../../external-data/application/sales-analytics.service';
import { SalesDataService } from '../../external-data/application/sales-data.service';
import { ResearchStorageService } from '../../gemini/application/research-storage.service';
import { PromptTemplateService } from '../../gemini/application/prompt-template.service';
import { PrismaService } from '../../database/prisma.service';
import { performance } from 'perf_hooks';
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
    private readonly prisma: PrismaService,
    private readonly salesDataService: SalesDataService,
    private readonly promptTemplateService: PromptTemplateService,
  ) {
    super();
  }

  async execute(params: Record<string, any>): Promise<ScriptResult> {
    const startTime = performance.now();
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
      const monthsEs = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      let queryMonth = 6;
      if (monthName) {
        const lowerMonth = monthName.toLowerCase().trim();
        const foundIndex = monthsEs.findIndex(m => lowerMonth.includes(m));
        if (foundIndex !== -1) {
          queryMonth = foundIndex + 1;
        }
      }
      let queryYear = 2026;
      if (monthName) {
        const yearMatch = monthName.match(/\b(202\d)\b/);
        if (yearMatch) {
          queryYear = parseInt(yearMatch[1], 10);
        }
      }
      const metrics = await this.salesAnalyticsService.generateStrategyMetrics(queryYear, queryMonth);
      this.logger.log('Strategy comparison data and recommended targets calculated.');

      // Share researchPrompt across both Single and Triple flows resolved from DB
      const researchPrompt = await this.promptTemplateService.resolvePrompt('deep-research', {
        MONTH_NAME: monthName,
      });

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
          const endTime = performance.now();
          const executionTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
          await this.prisma.executionLog.create({
            data: {
              agencyName,
              monthName,
              researchMode,
              reportMode,
              status: 'SUCCESS',
              executionTime,
              researchS3Key: this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode),
            },
          }).catch(dbErr => this.logger.error(`Failed to save execution log to DB: ${dbErr.message}`));

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
        if (await this.researchStorageService.hasImagesPdfReport(monthName, queryYear, agencyName, researchMode)) {
          this.logger.log(`Images PDF Report found in cache (Nivel 4.5 HIT). Loading from S3...`);
          imagesPdfBuffer = await this.researchStorageService.getImagesPdfReport(monthName, queryYear, agencyName, researchMode);
        } else if (await this.researchStorageService.hasUnifiedReport(monthName, queryYear, agencyName, researchMode)) {
          const unifiedReport = await this.researchStorageService.getUnifiedReport(monthName, queryYear, agencyName, researchMode);
          const catalog = this.extractImagesCatalog(unifiedReport);
          try {
            imagesPdfBuffer = await this.pdfService.generateCampaignImagesPdf(monthName, agencyName, catalog);
            await this.researchStorageService.saveImagesPdfReport(monthName, queryYear, agencyName, imagesPdfBuffer, researchMode);
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

Adjuntamos el Plan Estratégico de Ventas y Marketing correspondiente al periodo de ${monthName}. Este reporte unifica el análisis cuantitativo de ventas históricas, las proyecciones de objetivos sugeridos por modelo y la investigación estratégica de tendencias de mercado (Deep Research) para impulsar el desempeño comercial de la marca Jetour y Soueast en México.

El objetivo de ventas global recomendado para este periodo se establece en ${metrics.totals.suggestedGoal2026} unidades, lo que representa una tendencia de crecimiento anual acumulada del ${metrics.totals.growthRate}% en el trimestre de comparación. La justificación de metas individuales por modelo y las tácticas específicas de campañas de temporada y rotación de unidades seminuevas (Trade-in) se detallan a profundidad en el documento ejecutivo PDF anexo a este mensaje.`;

        this.logger.log(`Sending cached unified Strategic Sales Plan email with 3 attachments to ${emailDestination}...`);
        const emailSent = await this.emailService.sendMailWithAttachment(
          emailDestination,
          `Plan Estratégico de Ventas - ${monthName} (Caché)`,
          emailBodyText,
          pdfBuffer,
          `Plan_Estrategico_Ventas_${researchMode}_${monthName.replace(/\s+/g, '_')}.pdf`,
          undefined,
          additionalAttachments,
        );

        if (emailSent) {
          const endTime = performance.now();
          const executionTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
          await this.prisma.executionLog.create({
            data: {
              agencyName,
              monthName,
              researchMode,
              reportMode,
              status: 'SUCCESS',
              executionTime,
              researchS3Key: this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode),
              pdfS3Key: this.researchStorageService.getPdfS3Key(monthName, queryYear, agencyName, researchMode),
              imagesS3Key: this.researchStorageService.getImagesPdfS3Key(monthName, queryYear, agencyName, researchMode),
            },
          }).catch(dbErr => this.logger.error(`Failed to save execution log to DB: ${dbErr.message}`));

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
        const monthIdx = monthsEs.findIndex(m => monthName.toLowerCase().includes(m.toLowerCase()));
        
        let m1 = `Junio ${queryYear}`;
        let m2 = `Julio ${queryYear}`;
        let m3 = `Agosto ${queryYear}`;
        
        if (monthIdx !== -1) {
          const y1 = queryYear;
          const y2 = (monthIdx + 1) > 11 ? queryYear + 1 : queryYear;
          const y3 = (monthIdx + 2) > 11 ? queryYear + 1 : queryYear;

          m1 = `${monthsEs[monthIdx]} ${y1}`;
          m2 = `${monthsEs[(monthIdx + 1) % 12]} ${y2}`;
          m3 = `${monthsEs[(monthIdx + 2) % 12]} ${y3}`;
        }

        // --- FASE DE UNIFICACIÓN ESTRATÉGICA CON LLM (Gemini 3.5 Flash) (NIVEL 2 MISS) ---
        this.logger.log('Generating Unified Strategic Executive Report with Gemini 3.5 Flash...');
        const unificationPrompt = await this.promptTemplateService.resolvePrompt('brand-strategy', {
          SALES_METRICS: JSON.stringify(metrics, null, 2),
          DEEP_RESEARCH: realDeepResearchMarkdown,
          M1: m1,
          M2: m2,
          M3: m3,
        });

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
      const bannerPromptText = await this.promptTemplateService.resolvePrompt('image-banner', {
        MONTH_NAME: monthName,
      });
      
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

Adjuntamos el Plan Estratégico de Ventas y Marketing correspondiente al periodo de ${monthName}. Este reporte unifica el análisis cuantitativo de ventas históricas, las proyecciones de objetivos sugeridos por modelo y la investigación estratégica de tendencias de mercado (Deep Research) para impulsar el desempeño comercial de la marca Jetour y Soueast en México.

El objetivo de ventas global recomendado para este periodo se establece en ${metrics.totals.suggestedGoal2026} unidades, lo que representa una tendencia de crecimiento anual acumulada del ${metrics.totals.growthRate}% en el trimestre de comparación. La justificación de metas individuales por modelo y las tácticas específicas de campañas de temporada y rotación de unidades seminuevas (Trade-in) se detallan a profundidad en el documento ejecutivo PDF anexo a este mensaje.`;

      // Extract images catalog and generate images PDF
      const catalog = this.extractImagesCatalog(modifiedMarkdown);
      let imagesPdfBuffer: Buffer | undefined;
      try {
        imagesPdfBuffer = await this.pdfService.generateCampaignImagesPdf(monthName, agencyName, catalog);
        if (imagesPdfBuffer && !anyImageGenerationFailed) {
          await this.researchStorageService.saveImagesPdfReport(monthName, queryYear, agencyName, imagesPdfBuffer, researchMode);
        }
      } catch (pdfErr) {
        this.logger.error(`Error generating campaign images PDF: ${pdfErr.message}`);
      }

      const additionalAttachments: Array<{ content: Buffer; name: string }> = [
        {
          content: Buffer.from(realDeepResearchMarkdown || 'Reporte de Deep Research no disponible.', 'utf-8'),
          name: `Investigacion_Mercado_Deep_Research_${researchMode}_${monthName.replace(/\s+/g, '_')}.txt`,
        }
      ];

      if (imagesPdfBuffer) {
        additionalAttachments.push({
          content: imagesPdfBuffer,
          name: `Catalogo_Imagenes_Campanas_${monthName.replace(/\s+/g, '_')}.pdf`,
        });
      }

      this.logger.log(`Sending unified Strategic Sales Plan email with 3 attachments to ${emailDestination}...`);
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Plan Estratégico de Ventas y Marketing - ${monthName}`,
        emailBodyText,
        pdfBuffer,
        `Plan_Estrategico_Ventas_${researchMode}_${monthName.replace(/\s+/g, '_')}.pdf`,
        undefined,
        additionalAttachments,
      );

      if (emailSent) {
        const endTime = performance.now();
        const executionTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
        
        const masterLog = await this.prisma.executionLog.create({
          data: {
            agencyName,
            monthName,
            researchMode,
            reportMode,
            status: 'SUCCESS',
            executionTime,
            researchS3Key: this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode),
            pdfS3Key: this.researchStorageService.getPdfS3Key(monthName, queryYear, agencyName, researchMode),
            imagesS3Key: imagesPdfBuffer ? this.researchStorageService.getImagesPdfS3Key(monthName, queryYear, agencyName, researchMode) : null,
          },
        });

        // --- SUB-PROCESO POR DEALER/AGENCIA ---
        this.logger.log('Starting individual dealer strategic plan generation...');
        try {
          const distributors = await this.salesDataService.getDistribuidores();
          // Filter first 5 dealers for test phase
          const testDealers = distributors.slice(0, 5);
          
          this.logger.log(`Processing ${testDealers.length} test dealers for localized strategy reports...`);
          
          for (const dealer of testDealers) {
            const dealerStartTime = performance.now();
            
            // Extract attributes safely with fallbacks
            const distId = (dealer.dealerId || dealer.idDistribuidor || dealer.distribuidorID || dealer.id || '').toString();
            const distName = dealer.nombreComercial || dealer.nombre || dealer.distribuidor || `Distribuidor ${distId}`;
            const razonSocial = dealer.razonSocial || dealer.razon_social || distName;
            const ciudad = dealer.ciudad || dealer.municipio || '';
            const estado = dealer.estado || '';

            this.logger.log(`Generating strategy report for dealer ${distName} (ID: ${distId})...`);

            try {
              // 1. Fetch sales data filtered by this dealer
              const dealerMetrics = await this.salesAnalyticsService.generateStrategyMetrics(queryYear, queryMonth, distId);
              
              // 2. Build regionalized strategy prompt
              const dealerPrompt = await this.promptTemplateService.resolvePrompt('dealer-strategy', {
                MASTER_STRATEGY: modifiedMarkdown,
                DIST_NAME: distName,
                RAZON_SOCIAL: razonSocial,
                DIST_ID: distId,
                CIUDAD: ciudad,
                ESTADO: estado,
                SALES_3M_2026: dealerMetrics.totals.sales3Months2026,
                SALES_3M_2025: dealerMetrics.totals.sales3Months2025,
                GROWTH_RATE: dealerMetrics.totals.growthRate,
                MONTH_NAME: monthName,
                SUGGESTED_GOAL: dealerMetrics.totals.suggestedGoal2026,
                YEAR: queryYear,
                PREV_YEAR: queryYear - 1,
              });

              // 3. Invoke Gemini to customize strategy
              const dealerStrategyText = await this.geminiService.generateText(dealerPrompt, 'gemini-3.5-flash');

              // 4. Generate customized executive PDF
              const dealerPdfBuffer = await this.pdfService.generateExecutivePdf(
                monthName,
                distName,
                dealerMetrics,
                dealerStrategyText,
                bannerInfo
              );

              // 5. Upload PDF report to S3
              await this.researchStorageService.savePdfReport(monthName, queryYear, distName, dealerPdfBuffer, researchMode);
              const dealerPdfS3Key = this.researchStorageService.getPdfS3Key(monthName, queryYear, distName, researchMode);

              // 6. Save DealerExecutionLog in DB
              const dealerEndTime = performance.now();
              const dealerTime = parseFloat(((dealerEndTime - dealerStartTime) / 1000).toFixed(2));
              
              await this.prisma.dealerExecutionLog.create({
                data: {
                  parentLogId: masterLog.id,
                  dealerId: distId,
                  dealerName: distName,
                  razonSocial,
                  ciudad,
                  estado,
                  pdfS3Key: dealerPdfS3Key,
                  executionTime: dealerTime,
                  status: 'SUCCESS',
                }
              });

              // 7. Email report to dealer contact (sending to target destination for test/poc)
              await this.emailService.sendMailWithAttachment(
                emailDestination,
                `Plan Estratégico Local - ${distName} - ${monthName}`,
                `Estimado Gerente Comercial de ${distName},

Adjuntamos el Plan Estratégico Local de Ventas y Marketing correspondiente al periodo de ${monthName}, personalizado para tu distribuidor en ${ciudad}, ${estado}.

Este reporte atómico detalla tus métricas de ventas locales recientes, la comparativa anual, y las tácticas comerciales recomendadas en base a la línea central de la marca para cumplir tu objetivo mensual de ${dealerMetrics.totals.suggestedGoal2026} unidades.`,
                dealerPdfBuffer,
                `Plan_Estrategico_Dealer_${distId}_${monthName.replace(/\s+/g, '_')}.pdf`
              );

              this.logger.log(`Dealer ${distName} strategy report successfully generated, uploaded, logged and emailed.`);
            } catch (dealerErr) {
              this.logger.error(`Failed to process dealer ${distName} (ID: ${distId}): ${dealerErr.message}`, dealerErr.stack);
              const dealerEndTime = performance.now();
              const dealerTime = parseFloat(((dealerEndTime - dealerStartTime) / 1000).toFixed(2));
              
              await this.prisma.dealerExecutionLog.create({
                data: {
                  parentLogId: masterLog.id,
                  dealerId: distId,
                  dealerName: distName,
                  razonSocial,
                  ciudad,
                  estado,
                  executionTime: dealerTime,
                  status: 'FAILED',
                  errorMessage: dealerErr.message,
                }
              }).catch(dbErr => this.logger.error(`Failed to write failed dealer log: ${dbErr.message}`));
            }
          }
        } catch (catErr) {
          this.logger.error(`Failed to retrieve dealers catalog or process loop: ${catErr.message}`);
        }

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
      const endTime = performance.now();
      const executionTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));
      await this.prisma.executionLog.create({
        data: {
          agencyName,
          monthName,
          researchMode,
          reportMode,
          status: 'FAILED',
          executionTime,
          errorMessage: err.message,
        },
      }).catch(dbErr => this.logger.error(`Failed to save execution log to DB: ${dbErr.message}`));

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
