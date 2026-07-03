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
import { PptxService } from '../../notifications/application/pptx.service';
import { PodcastService } from '../../notifications/application/podcast.service';
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
    private readonly pptxService: PptxService,
    private readonly podcastService: PodcastService,
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

    // Granular Selection Parameters
    const generateExecutiveReport = params.generateExecutiveReport !== undefined ? Boolean(params.generateExecutiveReport) : (reportMode !== 'Single');
    const generateImages = params.generateImages !== undefined ? Boolean(params.generateImages) : true;
    const generateDealers = params.generateDealers !== undefined ? Boolean(params.generateDealers) : false;
    const dealersCount = params.dealersCount !== undefined ? Math.min(100, Math.max(1, parseInt(params.dealersCount, 10) || 5)) : 5;
    const generateSlides = params.generateSlides !== undefined ? Boolean(params.generateSlides) : false; // A3
    const generatePodcast = params.generatePodcast !== undefined ? Boolean(params.generatePodcast) : false; // A4
    const generateResearchSlides = params.generateResearchSlides !== undefined ? Boolean(params.generateResearchSlides) : false; // B
    const generateResearchPodcast = params.generateResearchPodcast !== undefined ? Boolean(params.generateResearchPodcast) : false; // C

    // Enforce A (Executive Report) if A1, A2, A3 or A4 are selected
    let activeGenerateExecutiveReport = generateExecutiveReport;
    if (generateImages || generateDealers || generateSlides || generatePodcast) {
      activeGenerateExecutiveReport = true;
    }

    this.logger.log(`Starting execute of DemoSalesPlanScript with dynamic configuration: [Executive: ${activeGenerateExecutiveReport} | Images: ${generateImages} | Dealers: ${generateDealers} (${dealersCount}) | Slides: ${generateSlides} | Podcast: ${generatePodcast} | ResearchSlides: ${generateResearchSlides} | ResearchPodcast: ${generateResearchPodcast}]`);

    try {
      // --- PASO DE AUTENTICACIÓN A PRUEBA ---
      this.logger.log('Validating Global DMS authentication credentials...');
      const token = await this.authService.getValidToken();
      this.logger.log(`Authentication successful. Token retrieved (length: ${token.length}).`);

      // --- PASO DE CÁLCULO DE TENDENCIAS Y MÉTRICAS HISTÓRICAS ---
      this.logger.log('Fetching and calculating historical sales trends YoY...');
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

      const researchPrompt = await this.promptTemplateService.resolvePrompt('deep-research', {
        MONTH_NAME: monthName,
      });

      // --- STEP 1: DEEP RESEARCH (Always generated or loaded since it serves as the source for other deliverables) ---
      let researchMd = '';
      let fromResearchCache = false;
      if (await this.researchStorageService.hasResearch(monthName, queryYear, researchMode)) {
        this.logger.log(`Deep Research found in cache (Nivel 1 HIT) for ${monthName} ${queryYear} (${researchMode}). Loading...`);
        researchMd = await this.researchStorageService.getResearch(monthName, queryYear, researchMode);
        fromResearchCache = true;
      } else {
        this.logger.log(`Executing REAL Deep Research (Nivel 1 MISS) using mode: ${researchMode}...`);
        researchMd = await this.geminiService.generateDeepResearch(researchPrompt, researchMode);
        await this.researchStorageService.saveResearch(monthName, queryYear, researchMd, researchMode);
      }

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

      // --- STEP 2: EXECUTIVE REPORT PDF & CAMPAIGN IMAGES (A & A1) ---
      if (activeGenerateExecutiveReport) {
        if (await this.researchStorageService.hasUnifiedReport(monthName, queryYear, agencyName, researchMode)) {
          this.logger.log(`Unified Strategy Report Markdown for ${agencyName} (${monthName} ${queryYear}) found in cache (Nivel 2 HIT). Loading...`);
          unifiedReport = await this.researchStorageService.getUnifiedReport(monthName, queryYear, agencyName, researchMode);
          fromUnifiedCache = true;
          modifiedMarkdown = unifiedReport;
        } else {
          this.logger.log(`Unified Strategy Report cache miss. Generating unifier strategy...`);
          const comparisonPrompt = await this.promptTemplateService.resolvePrompt('brand-strategy', {
            MONTH_NAME: monthName,
            BRAND_NAME: 'Jetour & Soueast',
            METRICS_SALES: JSON.stringify(metrics, null, 2),
            DEEP_RESEARCH: researchMd,
          });
          unifiedReport = await this.geminiService.generateText(comparisonPrompt, 'gemini-2.5-pro');
          await this.researchStorageService.saveUnifiedReport(monthName, queryYear, agencyName, unifiedReport, researchMode);
          modifiedMarkdown = unifiedReport;
        }

        let anyImageGenerationFailed = false;
        if (generateImages) {
          const cacheImagesDir = path.join(process.cwd(), 'data', 'cache', 'images');
          if (!fs.existsSync(cacheImagesDir)) {
            fs.mkdirSync(cacheImagesDir, { recursive: true });
          }

          this.logger.log('Generating dynamic cover banner image for report...');
          const bannerPrompt = `A professional, wide-angle banner photo showing the modern showroom of a Jetour and Soueast car dealership in Mexico featuring their latest SUV models in a premium neighborhood during ${monthName}. The atmosphere is upscale and clean, with local Mexican middle-class buyers exploring the cars. Clean composition, high-end commercial automotive photography style, warm natural sunset lighting, 8k resolution. No Asian text, no Asian characters, and no Asian or oriental people.`;
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
            this.logger.log(`Dynamic cover banner found in S3 cache (HIT). Loading...`);
            const bannerBuffer = await this.researchStorageService.getCampaignImage(bannerHash);
            fs.writeFileSync(bannerPath, bannerBuffer);
          } else {
            this.logger.log(`Generating dynamic cover banner (Nivel 3 MISS)...`);
            try {
              const buffer = await this.geminiService.generateImage(styledBannerPrompt);
              fs.writeFileSync(bannerPath, buffer);
              await this.researchStorageService.saveCampaignImage(bannerHash, buffer);
              this.logger.log('Dynamic cover banner generated and saved to cache/S3.');
            } catch (err: any) {
              this.logger.error(`Failed to generate cover banner image: ${err.message}`);
              anyImageGenerationFailed = true;
            }
          }

          this.logger.log('Extracting ads image prompts and resolving via local MD5 cache...');
          const catalog = this.extractImagesCatalog(modifiedMarkdown);
          this.logger.log(`Found ${catalog.length} campaign ads images to process.`);

          for (let i = 0; i < catalog.length; i++) {
            const item = catalog[i];
            const styledAdPrompt = `${item.prompt}. Styled for Mexican middle-high class families in Mexican settings, typical Mexican people, no Asian elements, no Chinese text, no oriental characters, no Asian people, realistic commercial photography.`;
            const itemHash = crypto.createHash('md5').update(styledAdPrompt.toLowerCase().trim()).digest('hex');

            // Ensure destination directory exists
            const destDir = path.dirname(item.path);
            if (!fs.existsSync(destDir)) {
              fs.mkdirSync(destDir, { recursive: true });
            }

            if (await this.researchStorageService.hasCampaignImage(itemHash)) {
              this.logger.log(`Ad image ${i + 1}/${catalog.length} found in S3 cache (HIT).`);
              const imageBuffer = await this.researchStorageService.getCampaignImage(itemHash);
              fs.writeFileSync(item.path, imageBuffer);
              modifiedMarkdown = modifiedMarkdown.replace(
                new RegExp(`\\[PROMPT:\\s*${this.escapeRegExp(item.prompt)}\\s*\\]`, 'gi'),
                `[IMAGE_DATA|path:${item.path}|prompt:${item.prompt}|model:${item.model}|file:ad_cache_${itemHash}.jpg]`
              );
            } else {
              this.logger.log(`Generating ad image ${i + 1}/${catalog.length} (Nivel 3 MISS) with prompt: "${item.prompt.substring(0, 60)}..."`);
              try {
                const buffer = await this.geminiService.generateImage(styledAdPrompt);
                fs.writeFileSync(item.path, buffer);
                await this.researchStorageService.saveCampaignImage(itemHash, buffer);
                modifiedMarkdown = modifiedMarkdown.replace(
                  new RegExp(`\\[PROMPT:\\s*${this.escapeRegExp(item.prompt)}\\s*\\]`, 'gi'),
                  `[IMAGE_DATA|path:${item.path}|prompt:${item.prompt}|model:${item.model}|file:ad_cache_${itemHash}.jpg]`
                );
                this.logger.log('Ad image generated and saved to cache/S3.');
              } catch (err: any) {
                this.logger.error(`Failed to generate ad image ${i + 1}: ${err.message}`);
                anyImageGenerationFailed = true;
              }
            }
          }
        } else {
          this.logger.log('Image generation is disabled (generateImages = false). Stripping all [PROMPT: ...] tags.');
          modifiedMarkdown = modifiedMarkdown.replace(/\[PROMPT:\s*(.*?)\]/gi, '');
        }

        // Render PDF Executive
        if (await this.researchStorageService.hasPdfReport(monthName, queryYear, agencyName, researchMode, generateImages)) {
          this.logger.log(`Final PDF Report found in cache (Nivel 4 HIT). Loading from disk...`);
          pdfBuffer = await this.researchStorageService.getPdfReport(monthName, queryYear, agencyName, researchMode, generateImages);
        } else {
          this.logger.log('Executive PDF cache miss. Generating executive PDF...');
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
            researchDate: '2026-07-02T19:52:51.839Z',
            researchDuration: '498s',
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
          if (!anyImageGenerationFailed) {
            await this.researchStorageService.savePdfReport(monthName, queryYear, agencyName, pdfBuffer, researchMode, generateImages);
          }
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
              if (imagesPdfBuffer && !anyImageGenerationFailed) {
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

      // --- STEP 5: SLIDES RESEARCH (B) ---
      if (generateResearchSlides) {
        if (await this.researchStorageService.hasPptxResearchReport(monthName, queryYear, agencyName, researchMode)) {
          this.logger.log('Research PowerPoint Slide Deck found in cache (HIT). Loading...');
          pptxResearchBuffer = await this.researchStorageService.getPptxResearchReport(monthName, queryYear, agencyName, researchMode);
        } else {
          this.logger.log('Research PowerPoint Slide Deck cache miss. Generating research slides...');
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

      // --- STEP 6: PODCAST RESEARCH (C) ---
      if (generateResearchPodcast) {
        if (await this.researchStorageService.hasPodcastResearchReport(monthName, queryYear, agencyName, researchMode)) {
          this.logger.log('Research Podcast found in cache (HIT). Loading...');
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
          researchS3Key: this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode),
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

      // --- STEP 7: INDIVIDUAL DEALER PLANS (A2) ---
      if (generateDealers && activeGenerateExecutiveReport) {
        this.logger.log(`Starting individual dealer strategic plan generation for ${dealersCount} dealers...`);
        try {
          const distributors = await this.salesDataService.getDistribuidores();
          const testDealers = distributors.slice(0, dealersCount);
          
          for (const dealer of testDealers) {
            const dealerStartTime = performance.now();
            const distId = (dealer.dealerId || dealer.idDistribuidor || dealer.distribuidorID || dealer.id || '').toString();
            const distName = dealer.nombreComercial || dealer.nombre || dealer.distribuidor || `Distribuidor ${distId}`;
            const razonSocial = dealer.razonSocial || dealer.razon_social || distName;
            const ciudad = dealer.ciudad || dealer.municipio || '';
            const estado = dealer.estado || '';

            this.logger.log(`Generating strategy report for dealer ${distName} (ID: ${distId})...`);

            try {
              let dealerPdfBuffer: Buffer;
              const dealerPdfS3Key = this.researchStorageService.getPdfS3Key(monthName, queryYear, distName, researchMode, generateImages);

              if (await this.researchStorageService.hasPdfReport(monthName, queryYear, distName, researchMode, generateImages)) {
                this.logger.log(`Dealer ${distName} PDF report found in cache (HIT). Downloading...`);
                dealerPdfBuffer = await this.researchStorageService.getPdfReport(monthName, queryYear, distName, researchMode, generateImages);
              } else {
                const dealerMetrics = await this.salesAnalyticsService.generateStrategyMetrics(queryYear, queryMonth, distId);
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

                const dealerStrategyText = await this.geminiService.generateText(dealerPrompt, 'gemini-3.5-flash');
                dealerPdfBuffer = await this.pdfService.generateExecutivePdf(
                  monthName,
                  distName,
                  dealerMetrics,
                  dealerStrategyText,
                  bannerInfo
                );
                await this.researchStorageService.savePdfReport(monthName, queryYear, distName, dealerPdfBuffer, researchMode, generateImages);
              }

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

              await this.emailService.sendMailWithAttachment(
                emailDestination,
                `Plan Estratégico Local - ${distName} - ${monthName}`,
                `Estimado Gerente Comercial de ${distName},\n\nAdjuntamos el Plan Estratégico Local de Ventas y Marketing correspondiente al periodo de ${monthName}, personalizado para tu distribuidor en ${ciudad}, ${estado}.`,
                dealerPdfBuffer,
                `Plan_Estrategico_Dealer_${distId}_${monthName.replace(/\s+/g, '_')}.pdf`
              );
            } catch (dealerErr: any) {
              this.logger.error(`Failed to process dealer ${distName} (ID: ${distId}): ${dealerErr.message}`);
            }
          }
        } catch (catErr: any) {
          this.logger.error(`Failed to retrieve dealers catalog: ${catErr.message}`);
        }
      }

      // --- STEP 8: SEND MAIN EMAIL ---
      const emailBodyText = `Estimado Director,

Adjuntamos los entregables solicitados del Plan Estratégico y de Investigación correspondiente al periodo de ${monthName}. 

Dependiendo de su selección, se han generado y anexado los correspondientes reportes ejecutivos, presentaciones PPTX y audios de podcast.`;

      const additionalAttachments: Array<{ content: Buffer; name: string }> = [
        {
          content: Buffer.from(researchMd, 'utf-8'),
          name: `Investigacion_Mercado_Deep_Research_${researchMode}_${monthName.replace(/\s+/g, '_')}.txt`,
        }
      ];

      if (imagesPdfBuffer) {
        additionalAttachments.push({
          content: imagesPdfBuffer,
          name: `Catalogo_Imagenes_Campanas_${monthName.replace(/\s+/g, '_')}.pdf`,
        });
      }
      if (pptxBuffer) {
        additionalAttachments.push({
          content: pptxBuffer,
          name: `Presentacion_Estrategia_Ejecutiva_${monthName.replace(/\s+/g, '_')}.pptx`,
        });
      }
      if (podcastBuffer) {
        additionalAttachments.push({
          content: podcastBuffer,
          name: `Podcast_Estrategia_Ejecutiva_${monthName.replace(/\s+/g, '_')}.mp3`,
        });
      }
      if (pptxResearchBuffer) {
        additionalAttachments.push({
          content: pptxResearchBuffer,
          name: `Presentacion_Estrategia_Research_${monthName.replace(/\s+/g, '_')}.pptx`,
        });
      }
      if (podcastResearchBuffer) {
        additionalAttachments.push({
          content: podcastResearchBuffer,
          name: `Podcast_Estrategia_Research_${monthName.replace(/\s+/g, '_')}.mp3`,
        });
      }

      this.logger.log(`Sending Strategic Sales Plan email with ${additionalAttachments.length} attachments to ${emailDestination}...`);
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Plan Estratégico - ${monthName}`,
        emailBodyText,
        pdfBuffer || undefined,
        pdfBuffer ? `Plan_Estrategico_Ventas_${researchMode}_${monthName.replace(/\s+/g, '_')}.pdf` : undefined,
        undefined,
        additionalAttachments,
      );

      if (emailSent) {
        return {
          success: true,
          message: `Script executed successfully. Report components generated and emailed to ${emailDestination}.`,
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
