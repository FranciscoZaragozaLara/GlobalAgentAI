import { Injectable, NotFoundException } from '@nestjs/common';
import { BaseScript } from './base-script';
import { DemoSalesPlanScript } from './demo-sales-plan.script';
import { DemoAftersalesPlanScript } from './demo-aftersales-plan.script';
import { ScriptResult } from '../domain/script.types';
import { PrismaService } from '../../database/prisma.service';
import { ResearchStorageService } from '../../gemini/application/research-storage.service';

@Injectable()
export class ScriptRunnerService {
  private readonly scriptsMap = new Map<string, BaseScript>();

  constructor(
    private readonly demoSalesPlanScript: DemoSalesPlanScript,
    private readonly demoAftersalesPlanScript: DemoAftersalesPlanScript,
    private readonly prisma: PrismaService,
    private readonly researchStorageService: ResearchStorageService,
  ) {
    // Register available scripts
    this.registerScript(this.demoSalesPlanScript);
    this.registerScript(this.demoAftersalesPlanScript);
  }

  private registerScript(script: BaseScript) {
    this.scriptsMap.set(script.name, script);
  }

  getAvailableScripts(): Array<{ name: string; description: string }> {
    return Array.from(this.scriptsMap.values()).map((script) => ({
      name: script.name,
      description: script.description,
    }));
  }

  async runScript(scriptName: string, params: Record<string, any>): Promise<ScriptResult> {
    const script = this.scriptsMap.get(scriptName);
    if (!script) {
      throw new NotFoundException(`Script with name '${scriptName}' not found`);
    }

    return await script.execute(params);
  }

  async getExecutionLogs() {
    const logs = await this.prisma.executionLog.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return await Promise.all(
      logs.map(async (log) => {
        let researchUrl: string | null = null;
        let pdfUrl: string | null = null;
        let imagesUrl: string | null = null;
        let pptxUrl: string | null = null;
        let podcastUrl: string | null = null;
        let podcastScriptUrl: string | null = null;

        let pptxResearchUrl: string | null = null;
        let podcastResearchUrl: string | null = null;
        let podcastResearchScriptUrl: string | null = null;

        if (log.researchS3Key) {
          researchUrl = await this.researchStorageService.getSignedUrl(log.researchS3Key);
        }
        if (log.pdfS3Key) {
          pdfUrl = await this.researchStorageService.getSignedUrl(log.pdfS3Key);
        }
        if (log.imagesS3Key) {
          imagesUrl = await this.researchStorageService.getSignedUrl(log.imagesS3Key);
        }
        if (log.pptxS3Key) {
          pptxUrl = await this.researchStorageService.getSignedUrl(log.pptxS3Key);
        }
        if (log.podcastS3Key) {
          podcastUrl = await this.researchStorageService.getSignedUrl(log.podcastS3Key);
        }
        if (log.podcastScriptS3Key) {
          podcastScriptUrl = await this.researchStorageService.getSignedUrl(log.podcastScriptS3Key);
        }
        if (log.pptxResearchS3Key) {
          pptxResearchUrl = await this.researchStorageService.getSignedUrl(log.pptxResearchS3Key);
        }
        if (log.podcastResearchS3Key) {
          podcastResearchUrl = await this.researchStorageService.getSignedUrl(log.podcastResearchS3Key);
        }
        if (log.podcastResearchScriptS3Key) {
          podcastResearchScriptUrl = await this.researchStorageService.getSignedUrl(log.podcastResearchScriptS3Key);
        }

        const dealerCount = await this.prisma.dealerExecutionLog.count({
          where: { parentLogId: log.id },
        });

        return {
          ...log,
          researchUrl,
          pdfUrl,
          imagesUrl,
          pptxUrl,
          podcastUrl,
          podcastScriptUrl,
          pptxResearchUrl,
          podcastResearchUrl,
          podcastResearchScriptUrl,
          dealerCount,
        };
      })
    );
  }

  async getDealerExecutionLogs(parentLogId: string) {
    const logs = await this.prisma.dealerExecutionLog.findMany({
      where: { parentLogId },
      orderBy: { createdAt: 'asc' },
    });

    return await Promise.all(
      logs.map(async (log) => {
        let pdfUrl: string | null = null;
        if (log.pdfS3Key) {
          pdfUrl = await this.researchStorageService.getSignedUrl(log.pdfS3Key);
        }

        return {
          ...log,
          pdfUrl,
        };
      })
    );
  }
}
