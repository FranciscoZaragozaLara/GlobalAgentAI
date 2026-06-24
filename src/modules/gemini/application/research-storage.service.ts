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
  private getResearchFilePath(month: string, year: number, researchMode: string = 'Basica'): string {
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `deep-research-${cleanMode}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return path.join(this.researchDir, filename);
  }

  hasResearch(month: string, year: number, researchMode: string = 'Basica'): boolean {
    const filePath = this.getResearchFilePath(month, year, researchMode);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking Deep Research Cache (${researchMode}) for ${month} ${year}: ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  getResearch(month: string, year: number, researchMode: string = 'Basica'): string {
    const filePath = this.getResearchFilePath(month, year, researchMode);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Research report not found in storage cache for ${month} ${year} (${researchMode})`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveResearch(month: string, year: number, markdownContent: string, researchMode: string = 'Basica'): void {
    const filePath = this.getResearchFilePath(month, year, researchMode);
    fs.writeFileSync(filePath, markdownContent, 'utf-8');
    this.logger.log(`Research report cached to disk: ${filePath}`);
  }

  // --- Tier 2: Unified Strategy Report (Pre-Images) Cache ---
  private getUnifiedFilePath(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `unified-report-${cleanMode}-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return path.join(this.unifiedDir, filename);
  }

  hasUnifiedReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): boolean {
    const filePath = this.getUnifiedFilePath(month, year, agencyName, researchMode);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking Unified Strategy Report Cache (${researchMode}) for ${agencyName} (${month} ${year}): ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  getUnifiedReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): string {
    const filePath = this.getUnifiedFilePath(month, year, agencyName, researchMode);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Unified strategy report not found in cache for ${agencyName} (${month} ${year}) (${researchMode})`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveUnifiedReport(month: string, year: number, agencyName: string, content: string, researchMode: string = 'Basica'): void {
    const filePath = this.getUnifiedFilePath(month, year, agencyName, researchMode);
    fs.writeFileSync(filePath, content, 'utf-8');
    this.logger.log(`Unified strategy report cached to disk: ${filePath}`);
  }

  // --- Tier 4: Final Executive PDF Cache ---
  private getPdfFilePath(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `reporte-ejecutivo-${cleanMode}-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.pdf`;
    return path.join(this.reportsDir, filename);
  }

  hasPdfReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): boolean {
    const filePath = this.getPdfFilePath(month, year, agencyName, researchMode);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking Final Executive PDF Cache (${researchMode}) for ${agencyName} (${month} ${year}): ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  getPdfReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Buffer {
    const filePath = this.getPdfFilePath(month, year, agencyName, researchMode);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Final PDF report not found in cache for ${agencyName} (${month} ${year}) (${researchMode})`);
    }
    return fs.readFileSync(filePath);
  }

  savePdfReport(month: string, year: number, agencyName: string, pdfBuffer: Buffer, researchMode: string = 'Basica'): void {
    const filePath = this.getPdfFilePath(month, year, agencyName, researchMode);
    fs.writeFileSync(filePath, pdfBuffer);
    this.logger.log(`Final executive PDF report cached to disk: ${filePath}`);
  }
}
