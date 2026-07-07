import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { PdfService } from '../../notifications/application/pdf.service';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { AuthService } from '../../auth/application/auth.service';
import { AftersalesAnalyticsService } from '../../external-data/application/aftersales-analytics.service';
import { ResearchStorageService } from '../../gemini/application/research-storage.service';
import { PromptTemplateService } from '../../gemini/application/prompt-template.service';
import { PrismaService } from '../../database/prisma.service';
import { PptxService } from '../../notifications/application/pptx.service';
import { PodcastService } from '../../notifications/application/podcast.service';
import { S3Service } from '../../gemini/application/s3.service';
import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class DemoAftersalesPlanScript extends BaseScript {
  private readonly logger = new Logger(DemoAftersalesPlanScript.name);
  readonly name = 'demo-aftersales-plan';
  readonly description = 'Script de planeación de posventa que genera Deep Research de logística, fletes y suministro de piezas, así como reportes e PDFs ejecutivos';

  constructor(
    private readonly pdfService: PdfService,
    private readonly emailService: EmailService,
    private readonly geminiService: GeminiService,
    private readonly authService: AuthService,
    private readonly aftersalesAnalyticsService: AftersalesAnalyticsService,
    private readonly researchStorageService: ResearchStorageService,
    private readonly prisma: PrismaService,
    private readonly promptTemplateService: PromptTemplateService,
    private readonly pptxService: PptxService,
    private readonly podcastService: PodcastService,
    private readonly s3Service: S3Service,
  ) {
    super();
  }

  async execute(params: Record<string, any>): Promise<ScriptResult> {
    const startTime = performance.now();
    const emailDestination = params.email || 'frzaragoza.arcade@gmail.com';
    const agencyName = params.agencyName || 'Jetour Soueast Posventa Demo';
    const monthName = params.monthName || 'Mes Actual';
    const researchMode = params.researchMode || 'Basica';
    const reportMode = params.reportMode || 'Posventa';

    // Granular Selection Parameters (Defaulting to true for full execution)
    const activeGenerateExecutiveReport = params.generateExecutiveReport !== false;
    const generateImages = params.generateImages !== false;
    const generateSlides = params.generateSlides !== false;
    const generatePodcast = params.generatePodcast !== false;
    const generateResearchSlides = params.generateResearchSlides !== false;
    const generateResearchPodcast = params.generateResearchPodcast !== false;

    this.logger.log(`Starting execute of DemoAftersalesPlanScript in mode [Research: ${researchMode}] target email: ${emailDestination}`);

    try {
      // 1. Resolve date information
      const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      let queryYear = new Date().getFullYear();
      let queryMonth = new Date().getMonth() + 1; // 1-indexed

      const yearMatch = monthName.match(/\b(202\d)\b/);
      if (yearMatch) {
        queryYear = parseInt(yearMatch[1], 10);
      }

      const cleanMonthOnly = monthName.replace(/\d+/g, '').trim().replace(/\bde\b/gi, '').trim();
      const detectedMonthIdx = monthsEs.findIndex(m => cleanMonthOnly.toLowerCase().includes(m.toLowerCase()));
      if (detectedMonthIdx !== -1) {
        queryMonth = detectedMonthIdx + 1;
      }

      // --- STEP 1: DEEP RESEARCH (TIER 1 CACHE) ---
      let researchMd = '';
      let fromResearchCache = false;

      if (await this.researchStorageService.hasResearch(monthName, queryYear, researchMode, 'aftersales')) {
        this.logger.log(`Deep Research found in cache (Nivel 1 HIT) for Aftersales ${monthName} ${queryYear} (${researchMode}). Loading...`);
        researchMd = await this.researchStorageService.getResearch(monthName, queryYear, researchMode, 'aftersales');
        fromResearchCache = true;
      } else {
        this.logger.log(`Executing REAL Deep Research (Nivel 1 MISS) for Aftersales using mode: ${researchMode}...`);
        const researchPrompt = await this.promptTemplateService.resolvePrompt('aftersales-deep-research', {
          MONTH_NAME: cleanMonthOnly,
          YEAR: queryYear,
        });
        researchMd = await this.geminiService.generateDeepResearch(researchPrompt, researchMode);
        await this.researchStorageService.saveResearch(monthName, queryYear, researchMd, researchMode, 'aftersales');
      }

      // Fetch workshop operational metrics
      this.logger.log(`Fetching workshop performance comparison from ERP for ${queryMonth}/${queryYear}...`);
      const metrics = await this.aftersalesAnalyticsService.generateAftersalesStrategyMetrics(queryYear, queryMonth);

      // Initialize keys and buffers for master log
      let pdfS3Key: string | null = null;
      let imagesS3Key: string | null = null;
      let pptxS3Key: string | null = null;
      let podcastS3Key: string | null = null;
      let podcastScriptS3Key: string | null = null;
      let pptxResearchS3Key: string | null = null;
      let podcastResearchS3Key: string | null = null;
      let podcastResearchScriptS3Key: string | null = null;

      let pdfBuffer: Buffer | null = null;
      let imagesPdfBuffer: Buffer | null = null;
      let pptxBuffer: Buffer | null = null;
      let podcastBuffer: Buffer | null = null;
      let pptxResearchBuffer: Buffer | null = null;
      let podcastResearchBuffer: Buffer | null = null;

      let unifiedReport = '';
      let fromUnifiedCache = false;
      let modifiedMarkdown = '';
      let bannerInfo: { path: string; prompt: string; model: string; file: string } | undefined;
      let trackingInfo: any;

      // --- STEP 2: EXECUTIVE REPORT PDF & IMAGES ---
      if (activeGenerateExecutiveReport) {
        if (await this.researchStorageService.hasUnifiedReport(monthName, queryYear, agencyName, researchMode)) {
          this.logger.log(`Unified Aftersales Report Markdown found in cache (Nivel 2 HIT) for ${agencyName}. Loading...`);
          unifiedReport = await this.researchStorageService.getUnifiedReport(monthName, queryYear, agencyName, researchMode);
          fromUnifiedCache = true;
          modifiedMarkdown = unifiedReport;
        } else {
          this.logger.log(`Unified Aftersales Report cache miss. Generating unifier strategy via Gemini 3.1 Pro...`);
          const monthsCapitalized = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const m1Idx = queryMonth - 1;
          const m2Idx = (m1Idx + 1) % 12;
          const m2Year = (m1Idx + 1) >= 12 ? queryYear + 1 : queryYear;
          const m3Idx = (m1Idx + 2) % 12;
          const m3Year = (m1Idx + 2) >= 12 ? queryYear + 1 : queryYear;

          const comparisonPrompt = await this.promptTemplateService.resolvePrompt('aftersales-brand-strategy', {
            MONTH_NAME: monthName,
            BRAND_NAME: 'Jetour & Soueast',
            AFTERSALES_METRICS: JSON.stringify(metrics, null, 2),
            DEEP_RESEARCH: researchMd,
            M1: `${monthsCapitalized[m1Idx]} ${queryYear}`,
            M2: `${monthsCapitalized[m2Idx]} ${m2Year}`,
            M3: `${monthsCapitalized[m3Idx]} ${m3Year}`,
          });

          unifiedReport = await this.geminiService.generateText(comparisonPrompt, 'gemini-3.1-pro');
          await this.researchStorageService.saveUnifiedReport(monthName, queryYear, agencyName, unifiedReport, researchMode);
          modifiedMarkdown = unifiedReport;
        }

        let anyImageGenerationFailed = false;
        if (generateImages) {
          const cacheImagesDir = path.join(process.cwd(), 'data', 'cache', 'images');
          if (!fs.existsSync(cacheImagesDir)) {
            fs.mkdirSync(cacheImagesDir, { recursive: true });
          }

          this.logger.log('Generating dynamic cover banner image for workshop report...');
          const bannerPrompt = `A professional, wide-angle banner photo showing the clean and technologically advanced service workshop of a modern Jetour and Soueast car dealership in Mexico during ${monthName}. Expert Mexican mechanics are performing maintenance with diagnostics tools under bright commercial lighting. Warm, upscale automotive service photography style, 8k resolution. No Asian text, no Asian characters, and no Asian or oriental people.`;
          const styledBannerPrompt = `${bannerPrompt}. Styled for Mexican middle-high class families in Mexican settings, typical Mexican people, no Asian elements, no Chinese text, no oriental characters, no Asian people, realistic commercial photography.`;
          const bannerHash = crypto.createHash('md5').update(styledBannerPrompt.toLowerCase().trim()).digest('hex');
          const bannerPath = path.join(cacheImagesDir, `banner_cache_${bannerHash}.jpg`);

          bannerInfo = {
            path: bannerPath,
            prompt: bannerPrompt,
            model: 'imagen-4.0-generate-001',
            file: `banner_cache_${bannerHash}.jpg`
          };

          if (await this.researchStorageService.hasCampaignImage(bannerHash)) {
            this.logger.log(`Dynamic workshop cover banner found in S3 cache (HIT).`);
            const bannerBuffer = await this.researchStorageService.getCampaignImage(bannerHash);
            fs.writeFileSync(bannerPath, bannerBuffer);
          } else {
            this.logger.log(`Generating dynamic workshop cover banner (Nivel 3 MISS)...`);
            try {
              await new Promise(resolve => setTimeout(resolve, 3000)); // Respect API limits
              const buffer = await this.geminiService.generateImage(styledBannerPrompt);
              fs.writeFileSync(bannerPath, buffer);
              await this.researchStorageService.saveCampaignImage(bannerHash, buffer);
            } catch (err: any) {
              this.logger.error(`Failed to generate cover banner image: ${err.message}`);
              anyImageGenerationFailed = true;
            }
          }

          this.logger.log('Extracting campaign service ads prompts...');
          const catalog = this.extractImagesCatalog(modifiedMarkdown);
          this.logger.log(`Found ${catalog.length} campaign service images to process.`);

          for (let i = 0; i < catalog.length; i++) {
            const item = catalog[i];
            const styledAdPrompt = `${item.prompt}. Styled for Mexican middle-high class families in Mexican settings, typical Mexican people, no Asian elements, no Chinese text, no oriental characters, no Asian people, realistic commercial photography.`;
            const itemHash = crypto.createHash('md5').update(styledAdPrompt.toLowerCase().trim()).digest('hex');

            const destDir = path.dirname(item.path);
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }

            if (await this.researchStorageService.hasCampaignImage(itemHash)) {
              const imageBuffer = await this.researchStorageService.getCampaignImage(itemHash);
              fs.writeFileSync(item.path, imageBuffer);
              modifiedMarkdown = modifiedMarkdown.replace(
                new RegExp(`\\[PROMPT:\\s*${this.escapeRegExp(item.prompt)}\\s*\\]`, 'gi'),
                `[IMAGE_DATA|path:${item.path}|prompt:${item.prompt}|model:${item.model}|file:ad_cache_${itemHash}.jpg]`
              );
            } else {
              try {
                await new Promise(resolve => setTimeout(resolve, 3000)); // Respect API limits
                const buffer = await this.geminiService.generateImage(styledAdPrompt);
                fs.writeFileSync(item.path, buffer);
                await this.researchStorageService.saveCampaignImage(itemHash, buffer);
                modifiedMarkdown = modifiedMarkdown.replace(
                  new RegExp(`\\[PROMPT:\\s*${this.escapeRegExp(item.prompt)}\\s*\\]`, 'gi'),
                  `[IMAGE_DATA|path:${item.path}|prompt:${item.prompt}|model:${item.model}|file:ad_cache_${itemHash}.jpg]`
                );
              } catch (err: any) {
                this.logger.error(`Failed to generate ad image ${i + 1}: ${err.message}`);
                anyImageGenerationFailed = true;
              }
            }
          }
        } else {
          this.logger.log('Image generation is disabled (generateImages = false).');
          modifiedMarkdown = modifiedMarkdown.replace(/\[PROMPT:\s*(.*?)\]/gi, '');
        }

        // Generate PDF
        if (await this.researchStorageService.hasPdfReport(monthName, queryYear, agencyName, researchMode, generateImages)) {
          this.logger.log(`Final Aftersales PDF Report found in cache (HIT).`);
          pdfBuffer = await this.researchStorageService.getPdfReport(monthName, queryYear, agencyName, researchMode, generateImages);
        } else {
          this.logger.log('Executive PDF cache miss. Generating dynamic executive PDF...');
          const sourcesSet = new Set<string>();
          const sourceRegex = /\[\d+\]\s+(https?:\/\/[^\s\)]+)/g;
          let match;
          while ((match = sourceRegex.exec(researchMd)) !== null) {
            sourcesSet.add(match[1]);
          }
          trackingInfo = {
            researchMode,
            interactionId: 'v1_ChdrOEZHYXA2Nk44MnZxdHNQeWJHN3VBZxIXazhGR2FwNjZOODJ2cXRzUHliRzd1QWc',
            promptHash: '08d86801ab4449fdfeb3c70dd9fe87e0',
            responseHash: 'b6a5c77f2d9d8b2dc5a37a122efb0bc0',
            researchDate: new Date().toISOString(),
            sources: Array.from(sourcesSet),
          };

          pdfBuffer = await this.pdfService.generateExecutivePdf(
            monthName,
            agencyName,
            metrics,
            modifiedMarkdown,
            bannerInfo,
            trackingInfo
          );
          await this.researchStorageService.savePdfReport(monthName, queryYear, agencyName, pdfBuffer, researchMode, generateImages);
        }
        pdfS3Key = this.researchStorageService.getPdfS3Key(monthName, queryYear, agencyName, researchMode, generateImages);

        // Generate Campaign Images PDF
        if (generateImages) {
          if (await this.researchStorageService.hasImagesPdfReport(monthName, queryYear, agencyName, researchMode)) {
            imagesPdfBuffer = await this.researchStorageService.getImagesPdfReport(monthName, queryYear, agencyName, researchMode);
          } else {
            const catalog = this.extractImagesCatalog(modifiedMarkdown);
            try {
              imagesPdfBuffer = await this.pdfService.generateCampaignImagesPdf(monthName, agencyName, catalog);
              if (imagesPdfBuffer) {
                await this.researchStorageService.saveImagesPdfReport(monthName, queryYear, agencyName, imagesPdfBuffer, researchMode);
              }
            } catch (pdfErr: any) {
              this.logger.error(`Error generating campaign images PDF: ${pdfErr.message}`);
            }
          }
          imagesS3Key = this.researchStorageService.getImagesPdfS3Key(monthName, queryYear, agencyName, researchMode);
        }

        // --- STEP 3: PPTX EXECUTIVE (A3) ---
        if (generateSlides) {
          if (await this.researchStorageService.hasPptxReport(monthName, queryYear, agencyName, researchMode)) {
            this.logger.log('PowerPoint Slide Deck found in cache (HIT). Loading...');
            pptxBuffer = await this.researchStorageService.getPptxReport(monthName, queryYear, agencyName, researchMode);
          } else {
            this.logger.log('PowerPoint Slide Deck cache miss. Generating executive slides...');
            try {
              const pptxPrompt = await this.promptTemplateService.resolvePrompt('pptx-strategy-structure', { REPORT_CONTENT: modifiedMarkdown });
              const responseText = await this.geminiService.generateText(pptxPrompt, 'gemini-3.5-flash');
              let slidesData: any[] = [];
              const firstBrace = responseText.indexOf('{');
              if (firstBrace !== -1) {
                const possibleEnds: number[] = [];
                let pos = responseText.indexOf('}', firstBrace);
                while (pos !== -1) {
                  possibleEnds.push(pos);
                  pos = responseText.indexOf('}', pos + 1);
                }
                for (let i = possibleEnds.length - 1; i >= 0; i--) {
                  try {
                    const candidate = responseText.substring(firstBrace, possibleEnds[i] + 1);
                    const parsedData = JSON.parse(candidate);
                    slidesData = parsedData.slides || [];
                    break;
                  } catch (e) {}
                }
              }
              if (slidesData.length > 0) {
                const catalog = this.extractImagesCatalog(modifiedMarkdown);
                const campaignImages = catalog.map(c => ({ path: c.path, exists: fs.existsSync(c.path) }));
                pptxBuffer = await this.pptxService.generateSlides(slidesData, campaignImages);
                await this.researchStorageService.savePptxReport(monthName, queryYear, agencyName, pptxBuffer, researchMode);
              }
            } catch (pptxErr: any) {
              this.logger.error(`Error generating PPTX slides: ${pptxErr.message}`);
            }
          }
          pptxS3Key = this.researchStorageService.getPptxS3Key(monthName, queryYear, agencyName, researchMode);
        }

        // --- STEP 4: PODCAST EXECUTIVE (A4) ---
        if (generatePodcast) {
          if (await this.researchStorageService.hasPodcastReport(monthName, queryYear, agencyName, researchMode)) {
            this.logger.log('Podcast audio found in S3 cache (HIT). Loading...');
            podcastBuffer = await this.researchStorageService.getPodcastReport(monthName, queryYear, agencyName, researchMode);
          } else {
            this.logger.log('Podcast cache miss. Generating executive podcast...');
            const podcastRes = await this.processPodcastOption(modifiedMarkdown, monthName, queryYear, agencyName, researchMode, false);
            podcastBuffer = podcastRes.podcastBuffer;
          }
          podcastS3Key = this.researchStorageService.getPodcastS3Key(monthName, queryYear, agencyName, researchMode);
          podcastScriptS3Key = this.researchStorageService.getPodcastScriptS3Key(monthName, queryYear, agencyName, researchMode);
        }
      }

      // --- STEP 5: RESEARCH SLIDES (B) ---
      if (generateResearchSlides) {
        if (await this.researchStorageService.hasPptxResearchReport(monthName, queryYear, agencyName, researchMode)) {
          pptxResearchBuffer = await this.researchStorageService.getPptxResearchReport(monthName, queryYear, agencyName, researchMode);
        } else {
          this.logger.log('Research Slides cache miss. Generating research slides...');
          try {
            const pptxPrompt = await this.promptTemplateService.resolvePrompt('pptx-strategy-structure', { REPORT_CONTENT: researchMd });
            const responseText = await this.geminiService.generateText(pptxPrompt, 'gemini-3.5-flash');
            let slidesData: any[] = [];
            const firstBrace = responseText.indexOf('{');
            if (firstBrace !== -1) {
              const possibleEnds: number[] = [];
              let pos = responseText.indexOf('}', firstBrace);
              while (pos !== -1) {
                possibleEnds.push(pos);
                pos = responseText.indexOf('}', pos + 1);
              }
              for (let i = possibleEnds.length - 1; i >= 0; i--) {
                try {
                  const candidate = responseText.substring(firstBrace, possibleEnds[i] + 1);
                  const parsedData = JSON.parse(candidate);
                  slidesData = parsedData.slides || [];
                  break;
                } catch (e) {}
              }
            }
            if (slidesData.length > 0) {
              pptxResearchBuffer = await this.pptxService.generateSlides(slidesData, []);
              await this.researchStorageService.savePptxResearchReport(monthName, queryYear, agencyName, pptxResearchBuffer, researchMode);
            }
          } catch (pptxErr: any) {
            this.logger.error(`Error generating Research PPTX slides: ${pptxErr.message}`);
          }
        }
        pptxResearchS3Key = this.researchStorageService.getPptxResearchS3Key(monthName, queryYear, agencyName, researchMode);
      }

      // --- STEP 6: RESEARCH PODCAST (C) ---
      if (generateResearchPodcast) {
        if (await this.researchStorageService.hasPodcastResearchReport(monthName, queryYear, agencyName, researchMode)) {
          podcastResearchBuffer = await this.researchStorageService.getPodcastResearchReport(monthName, queryYear, agencyName, researchMode);
        } else {
          this.logger.log('Research Podcast cache miss. Generating research podcast...');
          const podcastRes = await this.processPodcastOption(researchMd, monthName, queryYear, agencyName, researchMode, true);
          podcastResearchBuffer = podcastRes.podcastBuffer;
        }
        podcastResearchS3Key = this.researchStorageService.getPodcastResearchS3Key(monthName, queryYear, agencyName, researchMode);
        podcastResearchScriptS3Key = this.researchStorageService.getPodcastResearchScriptS3Key(monthName, queryYear, agencyName, researchMode);
      }

      // Create Master Execution Log in DB
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
          researchS3Key: this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode, 'aftersales'),
          pdfS3Key,
          imagesS3Key,
          pptxS3Key,
          podcastS3Key,
          podcastScriptS3Key,
          pptxResearchS3Key,
          podcastResearchS3Key,
          podcastResearchScriptS3Key,
        },
      });

      // --- STEP 8: SEND MAIN EMAIL ---
      const sevenDays = 604800;
      let pptxLink = '';
      let podcastLink = '';
      let pptxResearchLink = '';
      let podcastResearchLink = '';
      let imagesPdfLink = '';

      if (pptxS3Key) {
        try { pptxLink = await this.s3Service.getSignedUrl(pptxS3Key, sevenDays); } catch (e) {}
      }
      if (podcastS3Key) {
        try { podcastLink = await this.s3Service.getSignedUrl(podcastS3Key, sevenDays); } catch (e) {}
      }
      if (pptxResearchS3Key) {
        try { pptxResearchLink = await this.s3Service.getSignedUrl(pptxResearchS3Key, sevenDays); } catch (e) {}
      }
      if (podcastResearchS3Key) {
        try { podcastResearchLink = await this.s3Service.getSignedUrl(podcastResearchS3Key, sevenDays); } catch (e) {}
      }
      if (imagesS3Key) {
        try { imagesPdfLink = await this.s3Service.getSignedUrl(imagesS3Key, sevenDays); } catch (e) {}
      }

      const emailBodyText = `Estimado Director,

Adjuntamos los entregables estratégicos de Posventa y Refacciones para el periodo de ${monthName}. 

Debido al tamaño de las imágenes premium y archivos de audio integrados, hemos adjuntado el Reporte Ejecutivo Principal directamente en este correo y habilitado enlaces de descarga rápida (válidos por 7 días) para el resto del material audiovisual:

📦 Entregables Principales:
- 📈 Reporte Ejecutivo PDF Unificado (Adjunto en este correo)
${pptxLink ? `- 📊 Presentación de Slides Corporativa (Descarga): ${pptxLink}\n` : ''}${podcastLink ? `- 🎙️ Podcast de Audio Conversacional - Elena y David (Descarga/Reproducción): ${podcastLink}\n` : ''}${imagesPdfLink ? `- 🖼️ Catálogo Completo de Campañas y Anuncios de Servicio (Descarga): ${imagesPdfLink}\n` : ''}
🔍 Entregables de Investigación y Deep Research:
- 📄 Bitácora e Investigación de Logística Base (Archivo .txt adjunto)
${pptxResearchLink ? `- 🔎 Slides de la Investigación Logística (Descarga): ${pptxResearchLink}\n` : ''}${podcastResearchLink ? `- 🎧 Podcast de la Investigación Logística (Descarga/Reproducción): ${podcastResearchLink}\n` : ''}

El análisis cruza de forma integral los KPIs reales de productividad, TPU, retención y mix de canales del taller con la investigación profunda de logística de refacciones del mercado mexicano.`;

      const additionalAttachments: Array<{ content: Buffer; name: string }> = [
        {
          content: Buffer.from(researchMd, 'utf-8'),
          name: `Investigacion_Logistica_Deep_Research_${researchMode}_${monthName.replace(/\s+/g, '_')}.txt`,
        }
      ];

      this.logger.log(`Sending Strategic Aftersales Plan email with ${additionalAttachments.length} attachments to ${emailDestination}...`);
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Estrategia Corporativa Posventa y Refacciones - ${monthName}`,
        emailBodyText,
        pdfBuffer || undefined,
        pdfBuffer ? `Plan_Estrategico_Posventa_${monthName.replace(/\s+/g, '_')}.pdf` : undefined,
        undefined,
        additionalAttachments,
      );

      if (emailSent) {
        return {
          success: true,
          message: 'Aftersales strategy execution completed and deliverables sent successfully.',
          data: {
            destination: emailDestination,
            agency: agencyName,
            month: monthName,
            cacheHit: fromUnifiedCache ? 'UNIFIED_MD_NIVEL_2' : 'NONE'
          },
        };
      } else {
        throw new Error('Email delivery failed in Notifications service');
      }
    } catch (err: any) {
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

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractImagesCatalog(markdown: string): Array<{ path: string; prompt: string; model: string; filename: string }> {
    const catalog: Array<{ path: string; prompt: string; model: string; filename: string }> = [];
    const cacheImagesDir = path.join(process.cwd(), 'data', 'cache', 'images');
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

  private async processPodcastOption(
    reportContent: string,
    monthName: string,
    queryYear: number,
    agencyName: string,
    researchMode: string,
    isResearchPodcast: boolean = false,
  ): Promise<{ podcastS3Key: string | null; podcastScriptS3Key: string | null; podcastBuffer: Buffer | null }> {
    try {
      this.logger.log(`Generating podcast script and audio segments (${isResearchPodcast ? 'Research' : 'Executive'})...`);
      const scriptTurns = await this.podcastService.generatePodcastScript(reportContent);
      const scriptContent = JSON.stringify(scriptTurns, null, 2);

      this.logger.log('Synthesizing podcast script to binary audio stream...');
      const podcastBuffer = await this.podcastService.synthesizePodcast(scriptTurns);

      this.logger.log('Uploading podcast files to S3...');
      if (isResearchPodcast) {
        await this.researchStorageService.savePodcastResearchScript(monthName, queryYear, agencyName, scriptContent, researchMode);
        await this.researchStorageService.savePodcastResearchReport(monthName, queryYear, agencyName, podcastBuffer, researchMode);
        const podcastS3Key = this.researchStorageService.getPodcastResearchS3Key(monthName, queryYear, agencyName, researchMode);
        const podcastScriptS3Key = this.researchStorageService.getPodcastResearchScriptS3Key(monthName, queryYear, agencyName, researchMode);
        return { podcastS3Key, podcastScriptS3Key, podcastBuffer };
      } else {
        await this.researchStorageService.savePodcastScript(monthName, queryYear, agencyName, scriptContent, researchMode);
        await this.researchStorageService.savePodcastReport(monthName, queryYear, agencyName, podcastBuffer, researchMode);
        const podcastS3Key = this.researchStorageService.getPodcastS3Key(monthName, queryYear, agencyName, researchMode);
        const podcastScriptS3Key = this.researchStorageService.getPodcastScriptS3Key(monthName, queryYear, agencyName, researchMode);
        return { podcastS3Key, podcastScriptS3Key, podcastBuffer };
      }
    } catch (err: any) {
      this.logger.error(`Error generating podcast audio or script: ${err.message}`, err.stack);
      return { podcastS3Key: null, podcastScriptS3Key: null, podcastBuffer: null };
    }
  }
}
