import { Injectable, Logger } from '@nestjs/common';
import { BaseScript } from './base-script';
import { ScriptResult } from '../domain/script.types';
import { EmailService } from '../../notifications/application/email.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import { ResearchStorageService } from '../../gemini/application/research-storage.service';
import { PromptTemplateService } from '../../gemini/application/prompt-template.service';
import { PrismaService } from '../../database/prisma.service';
import { performance } from 'perf_hooks';
import * as crypto from 'crypto';

@Injectable()
export class DemoAftersalesPlanScript extends BaseScript {
  private readonly logger = new Logger(DemoAftersalesPlanScript.name);
  readonly name = 'demo-aftersales-plan';
  readonly description = 'Script de planeación de posventa que genera Deep Research de logística, fletes y suministro de piezas';

  constructor(
    private readonly emailService: EmailService,
    private readonly geminiService: GeminiService,
    private readonly researchStorageService: ResearchStorageService,
    private readonly prisma: PrismaService,
    private readonly promptTemplateService: PromptTemplateService,
  ) {
    super();
  }

  async execute(params: Record<string, any>): Promise<ScriptResult> {
    const startTime = performance.now();
    const emailDestination = params.email || 'frzaragoza.arcade@gmail.com';
    const agencyName = params.agencyName || 'Jetour Soueast Posventa Demo';
    const monthName = params.monthName || 'Enero 2025';
    const researchMode = params.researchMode || 'Basica';
    const reportMode = 'Posventa';

    this.logger.log(`Starting execute of DemoAftersalesPlanScript in mode [Research: ${researchMode}] target email: ${emailDestination}`);

    try {
      // 1. Extract year and month name
      const yearMatch = monthName.match(/\d{4}/);
      const queryYear = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
      const cleanMonthOnly = monthName.replace(/\d{4}/g, '').trim().replace(/\bde\b/gi, '').trim();

      let researchText = '';
      let isCached = false;

      // 2. Check S3 Cache (Tier 1: Deep Research)
      if (await this.researchStorageService.hasResearch(monthName, queryYear, researchMode, 'aftersales')) {
        this.logger.log(`Deep Research for Posventa ${monthName} found in S3 Cache. Loading...`);
        researchText = await this.researchStorageService.getResearch(monthName, queryYear, researchMode, 'aftersales');
        isCached = true;
      } else {
        this.logger.log(`Deep Research for Posventa ${monthName} not found in Cache. Calling Gemini...`);
        
        // Resolve dynamic prompt template from database
        const researchPrompt = await this.promptTemplateService.resolvePrompt('aftersales-deep-research', {
          MONTH_NAME: cleanMonthOnly,
          YEAR: queryYear,
        });

        // Run Google Gemini Deep Research agent
        researchText = await this.geminiService.generateDeepResearch(researchPrompt, researchMode);

        // Save to S3 cache
        await this.researchStorageService.saveResearch(monthName, queryYear, researchText, researchMode, 'aftersales');
      }

      // 3. Send notification email with attached research markdown
      this.logger.log(`Sending Deep Research report to ${emailDestination}...`);
      const emailBodyText = `Estimado Director,

Adjuntamos el reporte de investigación web profunda (Deep Research) correspondiente al análisis cualitativo externo de Posventa y Suministro de Refacciones para el periodo de ${monthName}.

Este reporte servirá de base de conocimientos para cruzar los datos de servicio y refacciones de los talleres.`;

      const emailSent = await this.emailService.sendMailWithAttachment(
        emailDestination,
        `Reporte Deep Research: Posventa y Refacciones - ${monthName}`,
        emailBodyText,
        Buffer.from(researchText, 'utf-8'),
        `Deep_Research_Posventa_${researchMode}_${monthName.replace(/\s+/g, '_')}.txt`,
      );

      if (emailSent) {
        const endTime = performance.now();
        const executionTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

        // 4. Log execution in DB
        await this.prisma.executionLog.create({
          data: {
            agencyName,
            monthName,
            researchMode,
            reportMode,
            status: 'SUCCESS',
            executionTime,
            researchS3Key: this.researchStorageService.getResearchS3Key(monthName, queryYear, researchMode, 'aftersales'),
          },
        });

        return {
          success: true,
          message: 'Aftersales Deep Research report generated and emailed successfully.',
          data: {
            destination: emailDestination,
            agency: agencyName,
            month: monthName,
            cacheHit: isCached ? 'HIT_S3' : 'MISS',
          },
        };
      } else {
        throw new Error('Failed to send email notification.');
      }
    } catch (error) {
      const endTime = performance.now();
      const executionTime = parseFloat(((endTime - startTime) / 1000).toFixed(2));

      this.logger.error(`Error executing DemoAftersalesPlanScript: ${error.message}`, error.stack);

      // Log failure in DB
      await this.prisma.executionLog.create({
        data: {
          agencyName,
          monthName,
          researchMode,
          reportMode,
          status: 'FAILED',
          executionTime,
          errorMessage: error.message,
        },
      });

      return {
        success: false,
        message: `Execution failed: ${error.message}`,
      };
    }
  }
}
