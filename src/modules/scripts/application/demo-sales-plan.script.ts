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
import { S3Service } from '../../gemini/application/s3.service';
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
    private readonly s3Service: S3Service,
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

      this.logger.log('Fetching and mapping current vehicle inventory totals and model breakdown...');
      try {
        const inventoryTotals = await this.salesDataService.getExistenciaNuevosSeminuevosTotales();
        const inventoryBrandModel = await this.salesDataService.getExistenciaResumenMarcaModelo();
        (metrics as any).inventory = {
          totals: inventoryTotals,
          brandModel: inventoryBrandModel,
        };
      } catch (invErr) {
        this.logger.error(`Error loading vehicle inventory metrics: ${invErr.message}`);
      }

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

      let pdfCacheHit = false;
      let imagesPdfCacheHit = false;
      let pptxCacheHit = false;
      let podcastCacheHit = false;
      let pptxResearchCacheHit = false;
      let podcastResearchCacheHit = false;

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
          const monthsCapitalized = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
          const m1Idx = queryMonth - 1;
          const m2Idx = (m1Idx + 1) % 12;
          const m2Year = (m1Idx + 1) >= 12 ? queryYear + 1 : queryYear;
          const m3Idx = (m1Idx + 2) % 12;
          const m3Year = (m1Idx + 2) >= 12 ? queryYear + 1 : queryYear;

          let comparisonPrompt = await this.promptTemplateService.resolvePrompt('brand-strategy', {
            MONTH_NAME: monthName,
            BRAND_NAME: 'Jetour & Soueast',
            SALES_METRICS: JSON.stringify(metrics, null, 2),
            DEEP_RESEARCH: researchMd,
            M1: `${monthsCapitalized[m1Idx]} ${queryYear}`,
            M2: `${monthsCapitalized[m2Idx]} ${m2Year}`,
            M3: `${monthsCapitalized[m3Idx]} ${m3Year}`,
          });

          comparisonPrompt += `\n\n[INSTRUCCIÓN CRÍTICA DE INVENTARIOS]: El objeto SALES_METRICS contiene el estado del INVENTARIO actual (totals y brandModel). Debes integrar obligatoriamente una sección titulada "### 4. Análisis y Evaluación de Inventario" en la propuesta comercial redactada. Analiza los rangos de días (con especial énfasis en el riesgo del volumen de unidades con antigüedad mayor a 120 días que representan un costo financiero latente) y modelos específicos de alta permanencia (como Jetour X70 con más de 300 días de antigüedad promedio). Identifica riesgos y oportunidades, y define estrategias específicas de venta o rotación (ej. dinámicas comerciales de liquidación, bonos de venta rápida o canalización a flotillas) bajo las mejores prácticas automotrices.`;

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
          pdfCacheHit = true;
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
          await this.researchStorageService.savePdfReport(monthName, queryYear, agencyName, pdfBuffer, researchMode, generateImages);
        }
        pdfS3Key = this.researchStorageService.getPdfS3Key(monthName, queryYear, agencyName, researchMode, generateImages);

        // Generate Campaign Images PDF
        if (generateImages) {
          if (await this.researchStorageService.hasImagesPdfReport(monthName, queryYear, agencyName, researchMode)) {
            imagesPdfBuffer = await this.researchStorageService.getImagesPdfReport(monthName, queryYear, agencyName, researchMode);
            imagesPdfCacheHit = true;
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
            pptxCacheHit = true;
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
            podcastCacheHit = true;
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
          pptxResearchCacheHit = true;
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
          podcastResearchCacheHit = true;
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
      const sevenDays = 604800;
      let pdfLink = '';
      let pptxLink = '';
      let podcastLink = '';
      let pptxResearchLink = '';
      let podcastResearchLink = '';
      let imagesPdfLink = '';
      let researchLink = '';

      if (pdfS3Key) {
        try { pdfLink = await this.s3Service.getSignedUrl(pdfS3Key, sevenDays); } catch (e) {}
      }
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
      const researchS3KeyVal = this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode, 'sales');
      if (researchS3KeyVal) {
        try { researchLink = await this.s3Service.getSignedUrl(researchS3KeyVal, sevenDays); } catch (e) {}
      }

      // Generate Executive Summary via Gemini 3.5 Flash
      this.logger.log('Generating sales executive summary for the email body using Gemini 3.5 Flash...');
      const summaryPrompt = `Eres un consultor ejecutivo especializado en ventas y marketing automotriz de la marca Jetour y Soueast.
Genera un Resumen Ejecutivo en formato de etiquetas HTML semánticas puras para el Director General basado en el siguiente reporte de ventas.
El resumen debe ser de alto impacto estratégico y muy profesional. 
Requisitos de Formato:
1. Utiliza subtítulos con la etiqueta <h3 style="color:#0B1E36; margin-top:20px; margin-bottom:10px; font-size:16px;">.
2. Utiliza viñetas con <ul> y <li style="margin-bottom:8px; line-height:1.5; color:#334155;">.
3. Resalta las cifras o métricas críticas (como volumen total, mix de modelos, porcentaje de crecimiento, días de inventario) usando <strong>.
4. Incluye exactamente una sección de "Métricas Clave de Desempeño" y otra sección de "Iniciativas Comerciales Recomendadas".
5. NO incluyas etiquetas de marcado markdown de código como \`\`\`html o \`\`\?, ni cabeceras <html>, <body> o <!DOCTYPE>. Empieza directamente con el contenido HTML.

Reporte de Ventas:
${modifiedMarkdown}
`;
      
      let executiveSummaryHtml = '';
      try {
        executiveSummaryHtml = await this.geminiService.generateText(summaryPrompt, 'gemini-3.5-flash');
        executiveSummaryHtml = executiveSummaryHtml.replace(/```html/gi, '').replace(/```/g, '').trim();
      } catch (sumErr) {
        this.logger.error(`Error generating HTML sales executive summary: ${sumErr.message}`);
        executiveSummaryHtml = `
          <p style="color:#334155; line-height:1.5;">Se han compilado exitosamente las métricas de ventas históricas, el análisis de inventario actual por días de permanencia y las comparativas de mercado. Por favor consulte el reporte unificado adjunto para el desglose del plan estratégico comercial.</p>
        `;
      }

      const genDateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });

      // Build beautiful responsive HTML Email Template
      const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Estrategia Corporativa Comercial y Ventas - ${monthName}</title>
</head>
<body style="margin:0; padding:0; background-color:#F1F5F9; font-family:'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F1F5F9; padding:20px 10px;">
    <tr>
      <td align="center">
        <!-- Main Card Wrapper -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); border: 1px solid #E2E8F0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0B1E36 0%, #1E3A8A 100%); padding:30px 24px; text-align:center; border-bottom: 4px solid #2B6CB0;">
              <span style="background-color:rgba(43,108,176,0.2); color:#60A5FA; font-size:11px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; padding:4px 8px; border-radius:20px; display:inline-block; margin-bottom:10px;">Dirección de Estrategia</span>
              <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:bold; letter-spacing:-0.5px;">Estrategia Comercial y de Ventas</h1>
              <p style="color:#93C5FD; margin:8px 0 0 0; font-size:14px;">Periodo: <strong>${monthName}</strong> | Agencia: ${agencyName}</p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:24px;">
              <p style="color:#334155; font-size:15px; margin:0 0 20px 0; line-height:1.6;">
                Estimado Director General,<br><br>
                Presentamos los entregables de planificación comercial, análisis de mercado y rotación de inventarios para el área de <strong>Ventas y Mercadotecnia</strong>. El reporte consolida de forma analítica las métricas históricas de la agencia y la situación real de vehículos en stock con la investigación sectorial del país.
              </p>

              <!-- IA Executive Summary Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F8FAFC; border-radius:8px; border-left:4px solid #2B6CB0; margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <h2 style="color:#0B1E36; margin:0 0 10px 0; font-size:16px; font-weight:bold; display:flex; align-items:center;">
                      💡 Resumen Ejecutivo de Ventas (IA)
                    </h2>
                    <div style="font-size:14px; color:#334155; line-height:1.5;">
                      ${executiveSummaryHtml}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Deliverables Table Section -->
              <h3 style="color:#0B1E36; font-size:16px; margin:0 0 12px 0; border-bottom:2px solid #E2E8F0; padding-bottom:8px;">📦 Catálogo de Entregables Estratégicos</h3>
              
              <div style="overflow-x:auto;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size:13px; text-align:left; border-collapse:collapse; min-width:500px;">
                  <thead>
                    <tr style="background-color:#0B1E36; color:#ffffff;">
                      <th style="padding:10px 12px; border-radius:4px 0 0 0;">Entregable</th>
                      <th style="padding:10px 12px; text-align:center;">Fecha</th>
                      <th style="padding:10px 12px; text-align:center;">Origen</th>
                      <th style="padding:10px 12px; text-align:center; border-radius:0 4px 0 0;">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    <!-- PDF Unificado -->
                    <tr style="border-bottom:1px solid #E2E8F0;">
                      <td style="padding:12px 8px;">
                        <strong>Reporte Principal PDF</strong><br>
                        <span style="font-size:11px; color:#64748B;">Métricas comerciales unificadas, inventario físico e investigación de mercado.</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${pdfCacheHit ? '#FEF3C7' : '#DCFCE7'}; color:${pdfCacheHit ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${pdfCacheHit ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        ${pdfLink ? `<a href="${pdfLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Descargar</a>` : '<span style="color:#94A3B8;">N/A</span>'}
                      </td>
                    </tr>

                    <!-- Catálogo de Imágenes -->
                    ${imagesPdfLink ? `
                    <tr style="border-bottom:1px solid #E2E8F0; background-color:#F8FAFC;">
                      <td style="padding:12px 8px;">
                        <strong>Catálogo de Imágenes de Campañas</strong><br>
                        <span style="font-size:11px; color:#64748B;">Propuestas visuales para campañas publicitarias (generado por IA).</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${imagesPdfCacheHit ? '#FEF3C7' : '#DCFCE7'}; color:${imagesPdfCacheHit ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${imagesPdfCacheHit ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        <a href="${imagesPdfLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Descargar</a>
                      </td>
                    </tr>
                    ` : ''}

                    <!-- PPTX Slides -->
                    ${pptxLink ? `
                    <tr style="border-bottom:1px solid #E2E8F0;">
                      <td style="padding:12px 8px;">
                        <strong>Presentación Slides PPTX</strong><br>
                        <span style="font-size:11px; color:#64748B;">Láminas ejecutivas de ventas para consejo administrativo.</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${pptxCacheHit ? '#FEF3C7' : '#DCFCE7'}; color:${pptxCacheHit ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${pptxCacheHit ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        <a href="${pptxLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Descargar</a>
                      </td>
                    </tr>
                    ` : ''}

                    <!-- Podcast MP3 -->
                    ${podcastLink ? `
                    <tr style="border-bottom:1px solid #E2E8F0; background-color:#F8FAFC;">
                      <td style="padding:12px 8px;">
                        <strong>Podcast de Audio MP3</strong><br>
                        <span style="font-size:11px; color:#64748B;">Resumen y debate del plan en formato de panel de audio.</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${podcastCacheHit ? '#FEF3C7' : '#DCFCE7'}; color:${podcastCacheHit ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${podcastCacheHit ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        <a href="${podcastLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Escuchar</a>
                      </td>
                    </tr>
                    ` : ''}

                    <!-- Research Slides -->
                    ${pptxResearchLink ? `
                    <tr style="border-bottom:1px solid #E2E8F0;">
                      <td style="padding:12px 8px;">
                        <strong>Slides PPTX del Deep Research</strong><br>
                        <span style="font-size:11px; color:#64748B;">Láminas detalladas sobre la investigación de competidores y mercado.</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${pptxResearchCacheHit ? '#FEF3C7' : '#DCFCE7'}; color:${pptxResearchCacheHit ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${pptxResearchCacheHit ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        <a href="${pptxResearchLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Descargar</a>
                      </td>
                    </tr>
                    ` : ''}

                    <!-- Research Podcast -->
                    ${podcastResearchLink ? `
                    <tr style="border-bottom:1px solid #E2E8F0; background-color:#F8FAFC;">
                      <td style="padding:12px 8px;">
                        <strong>Podcast del Deep Research MP3</strong><br>
                        <span style="font-size:11px; color:#64748B;">Conversación sobre los hallazgos competitivos sectoriales.</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${podcastResearchCacheHit ? '#FEF3C7' : '#DCFCE7'}; color:${podcastResearchCacheHit ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${podcastResearchCacheHit ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        <a href="${podcastResearchLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Escuchar</a>
                      </td>
                    </tr>
                    ` : ''}

                    <!-- Texto de Investigación -->
                    <tr style="border-bottom:1px solid #E2E8F0;">
                      <td style="padding:12px 8px;">
                        <strong>Reporte Completo de Investigación (TXT)</strong><br>
                        <span style="font-size:11px; color:#64748B;">Minuta íntegra del Deep Research de mercado.</span>
                      </td>
                      <td style="padding:12px 8px; text-align:center; color:#475569;">${genDateStr}</td>
                      <td style="padding:12px 8px; text-align:center;">
                        <span style="background-color:${fromResearchCache ? '#FEF3C7' : '#DCFCE7'}; color:${fromResearchCache ? '#D97706' : '#15803D'}; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:bold; white-space:nowrap;">
                          ${fromResearchCache ? '⚡ Caché' : '🆕 Real'}
                        </span>
                      </td>
                      <td style="padding:12px 8px; text-align:center;">
                        ${researchLink ? `<a href="${researchLink}" style="background-color:#2B6CB0; color:#ffffff; text-decoration:none; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:bold; display:inline-block; white-space:nowrap;">Descargar</a>` : '<span style="color:#94A3B8;">N/A</span>'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Expiry Alert -->
              <p style="background-color:#FFFBEB; border: 1px solid #FDE68A; border-radius:6px; padding:12px; color:#B45309; font-size:12px; margin-top:20px; line-height:1.4; text-align:center;">
                ⚠️ <strong>Nota de Seguridad:</strong> Por motivos de confidencialidad y protección de datos comerciales, los botones de descarga segura expirarán automáticamente en <strong>7 días</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#0B1E36; color:#94A3B8; text-align:center; padding:20px 24px; font-size:11px; border-top:1px solid #E2E8F0;">
              <p style="margin:0 0 4px 0; color:#ffffff; font-weight:bold;">Global Agent AI - Jetour & Soueast</p>
              <p style="margin:0;">Este es un reporte automático generado por el asistente de inteligencia artificial.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

      const emailBodyText = `Estimado Director,
Adjuntamos los entregables solicitados del Plan Estratégico Comercial correspondiente a ${monthName}.
Por favor, consulte la versión HTML del correo para acceder a los botones de descarga de PPTX, MP3 e investigación completa.`;

      this.logger.log('Sending Strategic Sales Plan email with premium HTML layout and S3 URLs...');
      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Plan Estratégico Comercial - ${monthName}`,
        emailBodyText,
        pdfBuffer || undefined,
        pdfBuffer ? `Plan_Estrategico_Ventas_${researchMode}_${monthName.replace(/\s+/g, '_')}.pdf` : undefined,
        htmlBody,
        [],
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
