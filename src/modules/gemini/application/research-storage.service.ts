import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ResearchStorageService {
  private readonly logger = new Logger(ResearchStorageService.name);
  private readonly storageDir = path.join(process.cwd(), 'data', 'research');

  constructor() {
    this.ensureStorageDirectoryExists();
  }

  private ensureStorageDirectoryExists() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      this.logger.log(`Created local research storage directory at: ${this.storageDir}`);
    }
  }

  private getFilePath(month: string, year: number): string {
    const filename = `deep-research-${month.toLowerCase().trim().replace(/\s+/g, '_')}-${year}.md`;
    return path.join(this.storageDir, filename);
  }

  /**
   * Checks if research already exists for given month and year
   */
  hasResearch(month: string, year: number): boolean {
    const filePath = this.getFilePath(month, year);
    const exists = fs.existsSync(filePath);
    this.logger.log(`Checking cache for period ${month} ${year}: ${exists ? 'HIT' : 'MISS'}`);
    return exists;
  }

  /**
   * Retrieves saved research markdown from disk
   */
  getResearch(month: string, year: number): string {
    const filePath = this.getFilePath(month, year);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Research report not found in storage cache for ${month} ${year}`);
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Persists research markdown draft to disk
   */
  saveResearch(month: string, year: number, markdownContent: string): void {
    const filePath = this.getFilePath(month, year);
    fs.writeFileSync(filePath, markdownContent, 'utf-8');
    this.logger.log(`Research report cached to disk: ${filePath}`);
  }
}
