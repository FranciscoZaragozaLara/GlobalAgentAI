import { Injectable, Logger } from '@nestjs/common';
import { S3Service } from './s3.service';

@Injectable()
export class ResearchStorageService {
  private readonly logger = new Logger(ResearchStorageService.name);

  constructor(private readonly s3Service: S3Service) {}

  // --- Tier 1: Deep Research Cache ---
  getResearchS3Key(month: string, year: number, researchMode: string = 'Basica'): string {
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `deep-research-${cleanMode}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return `research/${filename}`;
  }

  async hasResearch(month: string, year: number, researchMode: string = 'Basica'): Promise<boolean> {
    const key = this.getResearchS3Key(month, year, researchMode);
    const exists = await this.s3Service.fileExists(key);
    this.logger.log(`Checking S3 Deep Research Cache (${researchMode}) for ${month} ${year}: ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  async getResearch(month: string, year: number, researchMode: string = 'Basica'): Promise<string> {
    const key = this.getResearchS3Key(month, year, researchMode);
    return await this.s3Service.downloadFileAsString(key);
  }

  async saveResearch(month: string, year: number, markdownContent: string, researchMode: string = 'Basica'): Promise<void> {
    const key = this.getResearchS3Key(month, year, researchMode);
    await this.s3Service.uploadFile(key, markdownContent, 'text/markdown');
    this.logger.log(`Research report cached to S3: ${key}`);
  }

  // --- Tier 2: Unified Strategy Report Cache ---
  getUnifiedS3Key(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `unified-report-${cleanMode}-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return `unified/${filename}`;
  }

  async hasUnifiedReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Promise<boolean> {
    const key = this.getUnifiedS3Key(month, year, agencyName, researchMode);
    const exists = await this.s3Service.fileExists(key);
    this.logger.log(`Checking S3 Unified Strategy Report Cache (${researchMode}) for ${agencyName} (${month} ${year}): ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  async getUnifiedReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Promise<string> {
    const key = this.getUnifiedS3Key(month, year, agencyName, researchMode);
    return await this.s3Service.downloadFileAsString(key);
  }

  async saveUnifiedReport(month: string, year: number, agencyName: string, content: string, researchMode: string = 'Basica'): Promise<void> {
    const key = this.getUnifiedS3Key(month, year, agencyName, researchMode);
    await this.s3Service.uploadFile(key, content, 'text/markdown');
    this.logger.log(`Unified strategy report cached to S3: ${key}`);
  }

  // --- Tier 4: Final Executive PDF Cache ---
  getPdfS3Key(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `reporte-ejecutivo-${cleanMode}-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.pdf`;
    return `reports/${filename}`;
  }

  async hasPdfReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Promise<boolean> {
    const key = this.getPdfS3Key(month, year, agencyName, researchMode);
    const exists = await this.s3Service.fileExists(key);
    this.logger.log(`Checking S3 Final Executive PDF Cache (${researchMode}) for ${agencyName} (${month} ${year}): ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  async getPdfReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Promise<Buffer> {
    const key = this.getPdfS3Key(month, year, agencyName, researchMode);
    return await this.s3Service.downloadFile(key);
  }

  async savePdfReport(month: string, year: number, agencyName: string, pdfBuffer: Buffer, researchMode: string = 'Basica'): Promise<void> {
    const key = this.getPdfS3Key(month, year, agencyName, researchMode);
    await this.s3Service.uploadFile(key, pdfBuffer, 'application/pdf');
    this.logger.log(`Final executive PDF report cached to S3: ${key}`);
  }

  // --- Tier 4b: Campaign Images PDF Cache ---
  getImagesPdfS3Key(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): string {
    const cleanAgency = agencyName.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const cleanMode = researchMode.toLowerCase().trim();
    const filename = `catalogo-imagenes-${cleanMode}-${cleanAgency}-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.pdf`;
    return `reports/${filename}`;
  }

  async hasImagesPdfReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Promise<boolean> {
    const key = this.getImagesPdfS3Key(month, year, agencyName, researchMode);
    return await this.s3Service.fileExists(key);
  }

  async getImagesPdfReport(month: string, year: number, agencyName: string, researchMode: string = 'Basica'): Promise<Buffer> {
    const key = this.getImagesPdfS3Key(month, year, agencyName, researchMode);
    return await this.s3Service.downloadFile(key);
  }

  async saveImagesPdfReport(month: string, year: number, agencyName: string, pdfBuffer: Buffer, researchMode: string = 'Basica'): Promise<void> {
    const key = this.getImagesPdfS3Key(month, year, agencyName, researchMode);
    await this.s3Service.uploadFile(key, pdfBuffer, 'application/pdf');
    this.logger.log(`Campaign images PDF report cached to S3: ${key}`);
  }

  // --- Tier 5: Campaign Images Storage ---
  getCampaignImageS3Key(promptHash: string): string {
    return `images/ad_cache_${promptHash}.jpg`;
  }

  async hasCampaignImage(promptHash: string): Promise<boolean> {
    const key = this.getCampaignImageS3Key(promptHash);
    return await this.s3Service.fileExists(key);
  }

  async getCampaignImage(promptHash: string): Promise<Buffer> {
    const key = this.getCampaignImageS3Key(promptHash);
    return await this.s3Service.downloadFile(key);
  }

  async saveCampaignImage(promptHash: string, imageBuffer: Buffer): Promise<void> {
    const key = this.getCampaignImageS3Key(promptHash);
    await this.s3Service.uploadFile(key, imageBuffer, 'image/jpeg');
  }

  async getSignedUrl(key: string, expiresSeconds: number = 3600): Promise<string> {
    return await this.s3Service.getSignedUrl(key, expiresSeconds);
  }
}
