import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ResearchStorageService {
  private readonly logger = new Logger(ResearchStorageService.name);
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly researchDir = path.join(this.dataDir, 'research');
  private readonly unifiedDir = path.join(this.dataDir, 'unified');
  private readonly reportsDir = path.join(this.dataDir, 'reports');

  constructor() {
    this.ensureStorageDirectoriesExist();
  }

  private ensureStorageDirectoriesExist() {
    [this.researchDir, this.unifiedDir, this.reportsDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.log(`Created local storage directory at: ${dir}`);
      }
    });
  }

  // --- Tier 1: Deep Research Cache ---
  private getResearchFilePath(month: string, year: number): string {
    const filename = `deep-research-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return path.join(this.researchDir, filename);
  }

  hasResearch(month: string, year: number): boolean {
    const filePath = this.getResearchFilePath(month, year);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking Deep Research Cache for ${month} ${year}: ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  getResearch(month: string, year: number): string {
    const filePath = this.getResearchFilePath(month, year);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Research report not found in storage cache for ${month} ${year}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveResearch(month: string, year: number, markdownContent: string): void {
    const filePath = this.getResearchFilePath(month, year);
    fs.writeFileSync(filePath, markdownContent, 'utf-8');
    this.logger.log(`Research report cached to disk: ${filePath}`);
  }

  // --- Tier 2: Unified Strategy Report (Pre-Images) Cache ---
  private getUnifiedFilePath(month: string, year: number, agencyName: string): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const filename = `unified-report-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return path.join(this.unifiedDir, filename);
  }

  hasUnifiedReport(month: string, year: number, agencyName: string): boolean {
    const filePath = this.getUnifiedFilePath(month, year, agencyName);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking Unified Strategy Report Cache for ${agencyName} (${month} ${year}): ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  getUnifiedReport(month: string, year: number, agencyName: string): string {
    const filePath = this.getUnifiedFilePath(month, year, agencyName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Unified strategy report not found in cache for ${agencyName} (${month} ${year})`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveUnifiedReport(month: string, year: number, agencyName: string, content: string): void {
    const filePath = this.getUnifiedFilePath(month, year, agencyName);
    fs.writeFileSync(filePath, content, 'utf-8');
    this.logger.log(`Unified strategy report cached to disk: ${filePath}`);
  }

  // --- Tier 4: Final Executive PDF Cache ---
  private getPdfFilePath(month: string, year: number, agencyName: string): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const filename = `reporte-ejecutivo-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.pdf`;
    return path.join(this.reportsDir, filename);
  }

  hasPdfReport(month: string, year: number, agencyName: string): boolean {
    const filePath = this.getPdfFilePath(month, year, agencyName);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking Final Executive PDF Cache for ${agencyName} (${month} ${year}): ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  getPdfReport(month: string, year: number, agencyName: string): Buffer {
    const filePath = this.getPdfFilePath(month, year, agencyName);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Final PDF report not found in cache for ${agencyName} (${month} ${year})`);
    }
    return fs.readFileSync(filePath);
  }

  savePdfReport(month: string, year: number, agencyName: string, pdfBuffer: Buffer): void {
    const filePath = this.getPdfFilePath(month, year, agencyName);
    fs.writeFileSync(filePath, pdfBuffer);
    this.logger.log(`Final executive PDF report cached to disk: ${filePath}`);
  }
}
