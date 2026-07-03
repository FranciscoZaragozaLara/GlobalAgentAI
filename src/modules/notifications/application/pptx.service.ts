import { Injectable, Logger } from '@nestjs/common';
import PptxGenJS from 'pptxgenjs';
import * as fs from 'fs';
import * as path from 'path';

export interface SlideMetric {
  value: string;
  label: string;
  trend?: string;
}

export interface SlideData {
  slideType: 'cover' | 'metrics' | 'bullets' | 'two-columns' | 'campaign';
  title: string;
  subtitle?: string;
  metrics?: SlideMetric[];
  bullets?: string[];
  col1Title?: string;
  col2Title?: string;
  col1Bullets?: string[];
  col2Bullets?: string[];
  concept?: string;
  copy?: string;
}

@Injectable()
export class PptxService {
  private readonly logger = new Logger(PptxService.name);

  /**
   * Helper method to parse binary image headers (PNG/JPEG) to resolve dimension constraints
   */
  private getImageDimensions(filePath: string): { width: number; height: number; ratio: number } | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const buffer = fs.readFileSync(filePath);
      
      // PNG Signature
      if (buffer.readUInt32BE(0) === 0x89504E47) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        return { width, height, ratio: width / height };
      }
      
      // JPEG Signature
      if (buffer.readUInt16BE(0) === 0xFFD8) {
        let i = 2;
        while (i < buffer.length - 8) {
          const marker = buffer.readUInt16BE(i);
          if (marker === 0xFFD9) break; // End of image
          
          const length = buffer.readUInt16BE(i + 2);
          if (marker === 0xFFC0 || marker === 0xFFC2) {
            const height = buffer.readUInt16BE(i + 5);
            const width = buffer.readUInt16BE(i + 7);
            return { width, height, ratio: width / height };
          }
          i += length + 2;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to parse image dimensions for ${filePath}: ${err.message}`);
    }
    return null;
  }

  /**
   * Fits an image inside a box preserving aspect ratio (contain layout logic)
   */
  private calculateFitLayout(imagePath: string, boxX: number, boxY: number, boxW: number, boxH: number) {
    const dims = this.getImageDimensions(imagePath);
    if (!dims) {
      return { x: boxX, y: boxY, w: boxW, h: boxH };
    }
    
    const boxRatio = boxW / boxH;
    const imageRatio = dims.ratio;
    
    let finalW = boxW;
    let finalH = boxH;
    let finalX = boxX;
    let finalY = boxY;
    
    if (imageRatio > boxRatio) {
      finalW = boxW;
      finalH = boxW / imageRatio;
      finalY = boxY + (boxH - finalH) / 2;
    } else {
      finalH = boxH;
      finalW = boxH * imageRatio;
      finalX = boxX + (boxW - finalW) / 2;
    }
    
    return { x: finalX, y: finalY, w: finalW, h: finalH };
  }

  /**
   * Main generation method. Creates the PPTX presentation and returns it as a Buffer.
   */
  async generateSlides(
    slides: SlideData[],
    campaignImages: Array<{ path: string; exists: boolean }>,
  ): Promise<Buffer> {
    this.logger.log(`Generating presentation slide deck with ${slides.length} slides...`);
    
    const pres = new PptxGenJS();
    
    // Enforce 16:9 Widescreen (13.33 x 7.5 inches)
    pres.defineLayout({ name: 'WIDE_16_9', width: 13.33, height: 7.5 });
    pres.layout = 'WIDE_16_9';

    const cacheImagesDir = path.join(process.cwd(), 'data', 'cache', 'images');
    let campaignIndex = 0;

    for (const slideData of slides) {
      const slide = pres.addSlide();

      if (slideData.slideType === 'cover') {
        // --- 1. COVER LAYOUT ---
        slide.background = { fill: '0F172A' };

        // Left accent bar
        slide.addShape(pres.ShapeType.rect, {
          x: 0, y: 0, w: 2.66, h: 7.5,
          fill: { color: '4F46E5' }
        });

        // Cover banner (contain aspect ratio)
        if (fs.existsSync(cacheImagesDir)) {
          const bannerFilename = fs.readdirSync(cacheImagesDir).find(f => f.startsWith('banner_cache_'));
          if (bannerFilename) {
            const bannerPath = path.join(cacheImagesDir, bannerFilename);
            const fit = this.calculateFitLayout(bannerPath, 2.93, 0.75, 9.33, 2.625);
            slide.addImage({
              path: bannerPath,
              x: fit.x, y: fit.y, w: fit.w, h: fit.h
            });
          }
        }

        slide.addText('JETOUR & SOUEAST MÉXICO', {
          x: 2.93, y: 3.75, w: 9.33, h: 0.4,
          fontSize: 16, bold: true, color: '818CF8', fontFace: 'Trebuchet MS'
        });

        slide.addText(slideData.title, {
          x: 2.93, y: 4.15, w: 9.33, h: 1.2,
          fontSize: 30, bold: true, color: 'FFFFFF', fontFace: 'Trebuchet MS'
        });

        slide.addText(slideData.subtitle || '', {
          x: 2.93, y: 5.35, w: 9.33, h: 0.6,
          fontSize: 16, color: '9CA3AF', fontFace: 'Arial'
        });

        slide.addText('Documento Estratégico Reservado • Plan Mensual', {
          x: 2.93, y: 6.35, w: 9.33, h: 0.3,
          fontSize: 11, color: '64748B', fontFace: 'Arial', italic: true
        });

      } else {
        // --- STANDARD LAYOUTS ---
        slide.background = { fill: '0F172A' };

        // Header shape
        slide.addShape(pres.ShapeType.rect, {
          x: 0, y: 0, w: 13.33, h: 0.9,
          fill: { color: '1E293B' }
        });

        // Title
        slide.addText(slideData.title, {
          x: 0.6, y: 0.2, w: 12.13, h: 0.5,
          fontSize: 22, bold: true, color: 'FFFFFF', fontFace: 'Trebuchet MS'
        });

        if (slideData.slideType === 'metrics') {
          // A) METRICS LAYOUT (Non-overlapping cards + bullets text container)
          const metrics = slideData.metrics || [];
          const cardW = 2.2;
          const cardH = 2.4;
          const spacing = 0.3;

          metrics.forEach((metric, index) => {
            const cardX = 0.6 + index * (cardW + spacing);
            
            slide.addShape(pres.ShapeType.rect, {
              x: cardX, y: 1.6, w: cardW, h: cardH,
              fill: { color: '1E293B' },
              line: { color: '4F46E5', width: 2 }
            });

            slide.addText(metric.value, {
              x: cardX + 0.05, y: 1.8, w: cardW - 0.1, h: 0.6,
              fontSize: 26, bold: true, color: '818CF8', fontFace: 'Trebuchet MS', align: 'center'
            });

            slide.addText(metric.label, {
              x: cardX + 0.1, y: 2.5, w: cardW - 0.2, h: 0.8,
              fontSize: 10, color: 'E2E8F0', fontFace: 'Arial', align: 'center', bold: true
            });

            if (metric.trend) {
              slide.addText(metric.trend, {
                x: cardX + 0.1, y: 3.4, w: cardW - 0.2, h: 0.4,
                fontSize: 9, color: '34D399', fontFace: 'Arial', align: 'center'
              });
            }
          });

          // Single box text bullets to prevent overlap issues
          const rightColX = 0.6 + metrics.length * (cardW + spacing) + 0.3;
          const rightColW = 12.73 - rightColX;
          const bullets = slideData.bullets || [];

          const bulletTextObjects = bullets.map(text => {
            return { text: text + '\n\n', options: { fontSize: 13, color: 'CBD5E1', fontFace: 'Arial' } };
          });

          slide.addText(bulletTextObjects, {
            x: rightColX, y: 1.6, w: rightColW, h: 4.5,
            valign: 'top'
          });

        } else if (slideData.slideType === 'bullets') {
          // B) BULLETS LAYOUT
          const bullets = slideData.bullets || [];
          const bulletTextObjects = bullets.map(text => {
            return { text: text + '\n\n', options: { fontSize: 14, color: 'CBD5E1', fontFace: 'Arial' } };
          });

          slide.addText(bulletTextObjects, {
            x: 0.8, y: 1.6, w: 11.73, h: 4.5,
            valign: 'top'
          });

        } else if (slideData.slideType === 'two-columns') {
          // C) TWO COLUMNS LAYOUT
          slide.addText(slideData.col1Title || '', {
            x: 0.6, y: 1.4, w: 5.8, h: 0.4,
            fontSize: 18, bold: true, color: '818CF8', fontFace: 'Trebuchet MS'
          });

          const col1Bullets = slideData.col1Bullets || [];
          const col1TextObjects = col1Bullets.map(text => {
            return { text: text + '\n\n', options: { fontSize: 13, color: 'CBD5E1', fontFace: 'Arial' } };
          });

          slide.addText(col1TextObjects, {
            x: 0.6, y: 2.0, w: 5.8, h: 4.2,
            valign: 'top'
          });

          slide.addText(slideData.col2Title || '', {
            x: 6.9, y: 1.4, w: 5.8, h: 0.4,
            fontSize: 18, bold: true, color: '34D399', fontFace: 'Trebuchet MS'
          });

          const col2Bullets = slideData.col2Bullets || [];
          const col2TextObjects = col2Bullets.map(text => {
            return { text: text + '\n\n', options: { fontSize: 13, color: 'CBD5E1', fontFace: 'Arial' } };
          });

          slide.addText(col2TextObjects, {
            x: 6.9, y: 2.0, w: 5.8, h: 4.2,
            valign: 'top'
          });

        } else if (slideData.slideType === 'campaign') {
          // D) CAMPAIGN LAYOUT WITH PRECISE IMAGE POSITIONING
          slide.addText('📌 CONCEPTO CLAVE:', {
            x: 0.6, y: 1.5, w: 5.8, h: 0.3,
            fontSize: 12, bold: true, color: '818CF8', fontFace: 'Trebuchet MS'
          });

          slide.addText(slideData.concept || '', {
            x: 0.6, y: 1.9, w: 5.8, h: 0.8,
            fontSize: 14, color: 'E2E8F0', fontFace: 'Arial', italic: true
          });

          slide.addText('📱 AD COPY SUGERIDO:', {
            x: 0.6, y: 2.9, w: 5.8, h: 0.3,
            fontSize: 12, bold: true, color: '818CF8', fontFace: 'Trebuchet MS'
          });

          slide.addText(slideData.copy || '', {
            x: 0.6, y: 3.3, w: 5.8, h: 2.2,
            fontSize: 13, color: 'CBD5E1', fontFace: 'Arial',
            fill: { color: '1E293B' },
            inset: 0.2
          });

          const targetImage = campaignImages[campaignIndex];
          if (targetImage && targetImage.exists) {
            const fit = this.calculateFitLayout(targetImage.path, 6.8, 1.4, 5.9, 4.8);
            slide.addImage({
              path: targetImage.path,
              x: fit.x, y: fit.y, w: fit.w, h: fit.h
            });
          } else {
            slide.addShape(pres.ShapeType.rect, {
              x: 6.8, y: 1.4, w: 5.9, h: 4.8,
              fill: { color: '1E293B' },
              line: { color: '4F46E5', width: 2, dashType: 'dash' }
            });
            slide.addText('📷 Campaña Visual Imagen 4.0\n(Muestra No Disponible)', {
              x: 6.8, y: 3.4, w: 5.9, h: 0.8,
              fontSize: 14, color: '64748B', fontFace: 'Arial', align: 'center'
            });
          }
          
          campaignIndex++;
        }

        // Footer standard details
        slide.addText('Confidencial - Exclusivo Directores', {
          x: 0.5, y: 6.8, w: 6, h: 0.3,
          fontSize: 10, color: '64748B', fontFace: 'Arial'
        });
      }
    }

    // Write file to a buffer inside Node.js
    const outputBuffer = await pres.write({ outputType: 'nodebuffer' }) as Buffer;
    return outputBuffer;
  }
}
