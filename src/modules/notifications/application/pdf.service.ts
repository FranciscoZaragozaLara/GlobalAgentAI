import { Injectable, Logger } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { Writable } from 'stream';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  /**
   * Generates a visual executive PDF report including charts, tables, and research text
   */
  async generateExecutivePdf(
    month: string,
    agencyName: string,
    metrics: any,
    deepResearchMarkdown: string,
    bannerInfo?: { path: string; prompt: string; model: string; file: string },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];

      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      doc.pipe(stream);

      // --- PAGE 1: PORTADA Y RESUMEN EJECUTIVO ---
      // Try to draw the dynamic banner image
      const imageStartY = 50;
      const imageHeight = 120;
      let hasBannerDrawn = false;

      if (bannerInfo && fs.existsSync(bannerInfo.path)) {
        try {
          doc.image(bannerInfo.path, 50, imageStartY, { fit: [495, imageHeight], align: 'center' });
          
          doc.fillColor('#718096')
             .fontSize(6)
             .font('Helvetica-Oblique')
             .text(`"${bannerInfo.prompt.substring(0, 160)}..."`, 50, imageStartY + imageHeight + 4, { align: 'center', width: 495 });
          doc.font('Helvetica')
             .text(`Modelo: ${bannerInfo.model}  |  Archivo: ${bannerInfo.file}`, { align: 'center', width: 495 });
          
          hasBannerDrawn = true;
        } catch (imgErr) {
          this.logger.error(`Error embedding dynamic banner image: ${imgErr.message}`);
        }
      }

      if (!hasBannerDrawn) {
        // Fallback banner placeholder styling
        doc.rect(50, 50, 495, imageHeight).fill('#1A365D');
        doc.fillColor('#FFFFFF')
           .fontSize(20)
           .font('Helvetica-Bold')
           .text('JETOUR & SOUEAST MÉXICO', 70, 95);
      }

      // Explicitly position doc.y to avoid any text overlap with the banner image
      doc.y = imageStartY + imageHeight + 30;

      // Title & Subtitle
      doc.fillColor('#1A365D')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text('PLAN ESTRATÉGICO DE VENTAS', { align: 'left' });
      
      doc.fillColor('#2B6CB0')
         .fontSize(16)
         .font('Helvetica')
         .text(`Estrategia Comercial y Objetivos — ${month} 2026`, { align: 'left' });
      
      doc.moveDown(1.5);
      doc.strokeColor('#CBD5E0')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();
      doc.moveDown(1.5);

      // Metadata card
      doc.rect(50, doc.y, 495, 80).fill('#F7FAFC');
      doc.fillColor('#2D3748')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text('INFORMACIÓN GENERAL DEL REPORTE', 70, doc.y + 15)
         .font('Helvetica')
         .text(`Agencia/Canal: ${agencyName}`, 70, doc.y + 35)
         .text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 70, doc.y + 50)
         .text(`Moneda/Métricas: Unidades de Venta Fisicas`, 320, doc.y + 35)
         .text(`Autor: Corporativo Ventas Nacionales`, 320, doc.y + 50);

      doc.y += 45; // Reset Y position manually below metadata card

      // Page break for the metrics and analytics
      doc.addPage();

      // --- PAGE 2: ANÁLISIS DE VENTAS Y METAS ---
      doc.fillColor('#1A365D')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('1. Indicadores de Ventas e Históricos Comparativos');
      
      const monthsEs = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const monthIdx = monthsEs.findIndex(m => m.toLowerCase().includes(month.toLowerCase()));
      let prevMonthsNames = '';
      if (monthIdx !== -1) {
        const p1 = monthsEs[(monthIdx - 3 + 12) % 12].substring(0, 3);
        const p2 = monthsEs[(monthIdx - 2 + 12) % 12].substring(0, 3);
        const p3 = monthsEs[(monthIdx - 1 + 12) % 12].substring(0, 3);
        prevMonthsNames = `${p1}-${p2}-${p3}`;
      } else {
        prevMonthsNames = 'Mar-Abr-May';
      }

      doc.moveDown(0.5);
      doc.fillColor('#4A5568')
         .fontSize(10)
         .font('Helvetica')
         .text(`Comparativa del volumen acumulado de ventas del último trimestre (${prevMonthsNames}) contra el año anterior, mes equivalente de 2025 y objetivo proyectado:`);
      
      doc.moveDown(1.5);

      // Table Header
      const tableStartY = doc.y;
      doc.rect(50, tableStartY, 495, 22).fill('#2B6CB0');
      doc.fillColor('#FFFFFF')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('Modelo', 60, tableStartY + 7)
         .text('Trimestre 2025', 150, tableStartY + 7, { width: 70, align: 'center' })
         .text('Trimestre 2026', 230, tableStartY + 7, { width: 70, align: 'center' })
         .text('Crec. YoY %', 310, tableStartY + 7, { width: 60, align: 'center' })
         .text(`${month} 2025`, 380, tableStartY + 7, { width: 70, align: 'center' })
         .text(`Meta ${month} 2026`, 460, tableStartY + 7, { width: 75, align: 'center' });

      let currentY = tableStartY + 22;

      // Sort comparison records descending by current year's sales (Trimestre 2026)
      const sortedComparison = [...metrics.comparison].sort((a: any, b: any) => b.sales3Months2026 - a.sales3Months2026);

      // Table Rows
      sortedComparison.forEach((item: any, index: number) => {
        // Zebra striping
        if (index % 2 === 0) {
          doc.rect(50, currentY, 495, 20).fill('#F7FAFC');
        }
        
        doc.fillColor('#2D3748')
           .fontSize(9)
           .font('Helvetica')
           .text(item.model, 60, currentY + 5)
           .text(item.sales3Months2025.toString(), 150, currentY + 5, { width: 70, align: 'center' })
           .text(item.sales3Months2026.toString(), 230, currentY + 5, { width: 70, align: 'center' });

        const growthColor = item.growthRate >= 0 ? '#48BB78' : '#E53E3E';
        doc.fillColor(growthColor)
           .font('Helvetica-Bold')
           .text(`${item.growthRate}%`, 310, currentY + 5, { width: 60, align: 'center' });

        doc.fillColor('#2D3748')
           .font('Helvetica')
           .text(item.june2025.toString(), 380, currentY + 5, { width: 70, align: 'center' });

        doc.fillColor('#1A365D')
           .font('Helvetica-Bold')
           .text(item.suggestedGoal2026.toString(), 460, currentY + 5, { width: 75, align: 'center' });

        currentY += 20;
      });

      // Total Row
      doc.rect(50, currentY, 495, 22).fill('#E2E8F0');
      doc.fillColor('#1A365D')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('TOTAL MARCA', 60, currentY + 6)
         .text(metrics.totals.sales3Months2025.toString(), 150, currentY + 6, { width: 70, align: 'center' })
         .text(metrics.totals.sales3Months2026.toString(), 230, currentY + 6, { width: 70, align: 'center' });

      const totalGrowthColor = metrics.totals.growthRate >= 0 ? '#48BB78' : '#E53E3E';
      doc.fillColor(totalGrowthColor)
         .text(`${metrics.totals.growthRate}%`, 310, currentY + 6, { width: 60, align: 'center' });

      doc.fillColor('#1A365D')
         .text(metrics.totals.june2025.toString(), 380, currentY + 6, { width: 70, align: 'center' })
         .text(metrics.totals.suggestedGoal2026.toString(), 460, currentY + 6, { width: 75, align: 'center' });

      currentY += 40;
      doc.y = currentY;

      // --- GRÁFICA VECTORIAL DE BARRAS DE OBJETIVOS (PDFKit Direct Drawing) ---
      doc.x = 50; // Reset X to prevent right alignment overlap
      doc.fillColor('#1A365D')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('Gráfico Comparativo de Metas de Ventas por Modelo');
      
      doc.moveDown(0.5);

      const chartStartY = doc.y;
      const chartHeight = 130;
      const barHeight = 12;
      const chartModels = metrics.comparison.slice(0, 5); // top 5 models

      // Draw Y and X axis
      doc.strokeColor('#CBD5E0')
         .lineWidth(1.5)
         .moveTo(150, chartStartY)
         .lineTo(150, chartStartY + chartHeight) // Y Axis
         .lineTo(480, chartStartY + chartHeight) // X Axis
         .stroke();

      // Find max sales/goals for scaling
      const maxVal = Math.max(
        ...chartModels.map((m: any) => Math.max(m.sales3Months2026 / 3, m.suggestedGoal2026)),
        10
      );
      const scaleWidth = 300;
      const scaleFactor = scaleWidth / maxVal;

      chartModels.forEach((item: any, idx: number) => {
        const yOffset = chartStartY + 15 + (idx * 22);

        // Draw model label
        doc.fillColor('#2D3748')
           .fontSize(8)
           .font('Helvetica-Bold')
           .text(item.model, 60, yOffset + 3, { width: 85, align: 'right' });

        // Calculate values (recent monthly average vs target)
        const recentAvgVal = Math.round(item.sales3Months2026 / 3);
        const targetVal = item.suggestedGoal2026;

        const wAvg = recentAvgVal * scaleFactor;
        const wTarget = targetVal * scaleFactor;

        // Draw Recent Average Bar (light grey/blue)
        doc.rect(151, yOffset, Math.max(wAvg, 1), barHeight / 2).fill('#A0AEC0');

        // Draw Target Bar (blue acento)
        doc.rect(151, yOffset + (barHeight / 2) + 1, Math.max(wTarget, 1), barHeight / 2).fill('#2B6CB0');

        // Values label next to the bars
        doc.fillColor('#718096')
           .fontSize(7)
           .font('Helvetica')
           .text(`Prom: ${recentAvgVal} | Meta: ${targetVal}`, 155 + Math.max(wAvg, wTarget), yOffset + 2);
      });

      // Axis labels
      doc.fillColor('#718096')
         .fontSize(7)
         .font('Helvetica')
         .text('0', 148, chartStartY + chartHeight + 5)
         .text(Math.round(maxVal).toString(), 465, chartStartY + chartHeight + 5);

      // Legend
      doc.rect(340, chartStartY - 10, 8, 8).fill('#A0AEC0');
      doc.fillColor('#4A5568')
         .fontSize(8)
         .text('Promedio Mensual Reciente', 353, chartStartY - 9);

      doc.rect(340, chartStartY - 2, 8, 8).fill('#2B6CB0');
      doc.fillColor('#4A5568')
         .fontSize(8)
         .text('Meta Sugerida', 353, chartStartY - 1);

      // Page break for Deep Research
      doc.addPage();

      // --- PAGE 3+: ESTRATEGIA COMERCIAL UNIFICADA ---
      doc.fillColor('#1A365D')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('2. Plan Estratégico Comercial y Propuesta de Trabajo');
      
      doc.moveDown(1);

      // Reset base coordinates to flow naturally
      doc.x = 50;

      // Simple Markdown-like Renderer with natural flow (no absolute Y coordinates to let auto-paging work)
      const lines = deepResearchMarkdown.split('\n');
      let infographicInserted = false;

      lines.forEach((line) => {
        const trimmed = line.trim();

        if (trimmed.length === 0) {
          return;
        }

        // Skip raw markdown table rows (lines starting with '|')
        if (trimmed.startsWith('|')) {
          return;
        }

        // Skip lines that are just formatting remnants like "###" or "---"
        if (trimmed.match(/^#+$/) || trimmed.match(/^-+$/)) {
          return;
        }

        // Matches custom image markers [IMAGE_DATA|path:...|prompt:...|model:...|file:...]
        const imageMatch = trimmed.match(/\[IMAGE_DATA\|path:(.*?)\|prompt:(.*?)\|model:(.*?)\|file:(.*?)\]/i);
        if (imageMatch) {
          const imagePath = imageMatch[1].trim();
          const originalPrompt = imageMatch[2].trim();
          const modelUsed = imageMatch[3].trim();
          const fileName = imageMatch[4].trim();

          if (fs.existsSync(imagePath)) {
            try {
              if (doc.y > 600) {
                doc.addPage();
              }
              
              // Draw Image at absolute coordinates based on current doc.y
              const currentImageStartY = doc.y;
              doc.image(imagePath, 50, currentImageStartY, { fit: [495, 120], align: 'center' });
              doc.y = currentImageStartY + 125; // Compact spacing: 5pt below the maximum image height boundary (120)

              // Draw Caption
              doc.fillColor('#718096')
                 .fontSize(7)
                 .font('Helvetica-Oblique')
                 .text(`"${originalPrompt}"`, { align: 'center', width: 495 });
              
              doc.font('Helvetica')
                 .text(`Modelo: ${modelUsed}  |  Archivo: ${fileName}`, { align: 'center', width: 495 });
              
              doc.moveDown(0.8);
            } catch (imgErr) {
              this.logger.error(`Error embedding generated campaign image: ${imgErr.message}`);
            }
          }
          return;
        }

        // Clean double bold markers '**'
        const cleanLine = trimmed.replace(/\*\*/g, '');

        // Matches any Markdown heading (e.g. #, ##, ###, ####, #####, etc.)
        const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
          const level = headingMatch[1].length;
          const headingText = headingMatch[2].replace(/\*\*/g, '');

          // Skip level 1 or title headers
          if (level === 1 || headingText.includes('PLAN ESTRATÉGICO DE VENTAS') || headingText.includes('REPORTE EJECUTIVO')) {
            return;
          }

          if (level === 2) {
            if (doc.y > 660) {
              doc.addPage();
            } else {
              doc.moveDown(1.2);
            }

            // Insert Infographic Image if we are entering Section 2 (or Campañas) and haven't inserted it yet
            if (!infographicInserted && (headingText.toLowerCase().includes('campaña') || headingText.toLowerCase().includes('temporalidad') || doc.y > 450)) {
              const infographicPath = path.join(process.cwd(), 'data', 'assets', 'marketing_infographic.png');
              if (fs.existsSync(infographicPath)) {
                try {
                  doc.image(infographicPath, 50, doc.y, { fit: [495, 140], align: 'center' });
                  doc.y += 150;
                  infographicInserted = true;
                  if (doc.y > 700) doc.addPage();
                } catch (imgErr) {
                  this.logger.error(`Error embedding infographic: ${imgErr.message}`);
                }
              }
            }

            const headingY = doc.y;
            doc.rect(50, headingY, 4, 16).fill('#2B6CB0');

            doc.fillColor('#1A365D')
               .fontSize(12)
               .font('Helvetica-Bold');
            
            doc.x = 60;
            doc.text(headingText, { paragraphGap: 8 });
            doc.x = 50; // Reset
            return;
          }

          // Level 3 to 6
          if (doc.y > 690) {
            doc.addPage();
          } else {
            doc.moveDown(0.8);
          }

          doc.fillColor('#2B6CB0')
             .fontSize(10)
             .font('Helvetica-Bold')
             .text(headingText, { paragraphGap: 6 });
          return;
        }

        // Matches bullet points
        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)$/);
        if (bulletMatch) {
          const bulletText = bulletMatch[1].replace(/\*\*/g, '');
          
          doc.fillColor('#2D3748')
             .fontSize(9)
             .font('Helvetica')
             .text('• ' + bulletText, { indent: 12, paragraphGap: 4, align: 'left' });
          return;
        }

        // Plain text paragraphs
        if (cleanLine.length > 0) {
          doc.fillColor('#2D3748')
             .fontSize(9)
             .font('Helvetica')
             .text(cleanLine, { align: 'justify', paragraphGap: 8 });
          return;
        }
      });

      // --- ADD GLOBAL HEADERS, FOOTERS & PAGE NUMBERS ---
      const range = doc.bufferedPageRange();
      
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);

        // Temporarily clear margins for this page to prevent PDFKit from auto-creating blank pages
        const origTop = doc.page.margins.top;
        const origBottom = doc.page.margins.bottom;
        doc.page.margins.top = 0;
        doc.page.margins.bottom = 0;

        // Header (Skip cover page)
        if (i > 0) {
          doc.strokeColor('#E2E8F0')
             .lineWidth(0.5)
             .moveTo(50, 40)
             .lineTo(545, 40)
             .stroke();

          doc.fillColor('#718096')
             .fontSize(8)
             .font('Helvetica')
             .text('JETOUR & SOUEAST MÉXICO', 50, 28)
             .text(`Plan de Estrategia Comercial — ${month} 2026`, 300, 28, { align: 'right', width: 245 });
        }

        // Footer (On all pages)
        doc.strokeColor('#E2E8F0')
           .lineWidth(0.5)
           .moveTo(50, 790)
           .lineTo(545, 790)
           .stroke();

        doc.fillColor('#A0AEC0')
           .fontSize(8)
           .font('Helvetica')
           .text('Confidencial - Para uso interno corporativo', 50, 800)
           .text(`Página ${i + 1} de ${range.count}`, 400, 800, { align: 'right', width: 145 });

        // Restore page margins before moving to next page (or ending)
        doc.page.margins.top = origTop;
        doc.page.margins.bottom = origBottom;
      }

      doc.end();

      stream.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Generates a separate PDF containing only the generated images, their prompt, model, and hash/filename info
   */
  async generateCampaignImagesPdf(
    month: string,
    agencyName: string,
    images: Array<{ path: string; prompt: string; model: string; filename: string }>,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];

      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      doc.pipe(stream);

      // Title & Subtitle
      doc.fillColor('#1A365D')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('REPORTE DE IMÁGENES Y CREATIVOS DE CAMPAÑA', { align: 'left' });
      
      doc.fillColor('#2B6CB0')
         .fontSize(12)
         .font('Helvetica')
         .text(`Catálogo de Ads Generados por IA — ${month} 2026`, { align: 'left' });
      
      doc.moveDown(1);
      doc.strokeColor('#CBD5E0')
         .lineWidth(1)
         .moveTo(50, doc.y)
         .lineTo(545, doc.y)
         .stroke();
      doc.moveDown(1.5);

      // Metadata card
      doc.rect(50, doc.y, 495, 60).fill('#F7FAFC');
      doc.fillColor('#2D3748')
         .fontSize(9)
         .font('Helvetica-Bold')
         .text('METADATOS DEL REPORTE DE CREATIVOS', 70, doc.y + 12)
         .font('Helvetica')
         .text(`Distribuidor: ${agencyName}`, 70, doc.y + 28)
         .text(`Fecha: ${new Date().toLocaleDateString()}`, 70, doc.y + 40)
         .text(`Total Imágenes: ${images.length}`, 320, doc.y + 28)
         .text(`Motor de Renderizado: Google Imagen 4.0`, 320, doc.y + 40);

      doc.y += 65;

      // Draw each image with metadata
      images.forEach((img, idx) => {
        if (doc.y > 580) {
          doc.addPage();
        } else if (idx > 0) {
          doc.moveDown(2);
        }

        if (fs.existsSync(img.path)) {
          try {
            const currentY = doc.y;
            doc.image(img.path, 50, currentY, { fit: [495, 140], align: 'center' });
            doc.y = currentY + 145;

            // Prompt & Model metadata
            doc.fillColor('#2D3748')
               .fontSize(8)
               .font('Helvetica-Bold')
               .text(`Imagen #${idx + 1}: ${img.filename}`, { align: 'left' });

            doc.font('Helvetica-Oblique')
               .fillColor('#4A5568')
               .text(`Prompt: "${img.prompt}"`, { align: 'justify', width: 495 });

            doc.font('Helvetica')
               .fillColor('#718096')
               .text(`Modelo: ${img.model} | Ruta: ${img.path}`, { align: 'left' });

          } catch (err) {
            doc.fillColor('#E53E3E')
               .fontSize(10)
               .text(`Error cargando imagen: ${err.message}`);
          }
        } else {
          doc.fillColor('#E53E3E')
             .fontSize(10)
             .text(`Imagen no encontrada: ${img.filename}`);
        }
      });

      // Page numbers footer
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        doc.page.margins.top = 0;
        doc.page.margins.bottom = 0;

        // Header
        if (i > 0) {
          doc.strokeColor('#E2E8F0')
             .lineWidth(0.5)
             .moveTo(50, 40)
             .lineTo(545, 40)
             .stroke();

          doc.fillColor('#718096')
             .fontSize(8)
             .font('Helvetica')
             .text('REPORTES DE IMÁGENES DE ADS', 50, 28)
             .text(`${month} 2026`, 300, 28, { align: 'right', width: 245 });
        }

        // Footer
        doc.strokeColor('#E2E8F0')
           .lineWidth(0.5)
           .moveTo(50, 790)
           .lineTo(545, 790)
           .stroke();

        doc.fillColor('#A0AEC0')
           .fontSize(7)
           .font('Helvetica')
           .text('DOCUMENTO ADJUNTO CONFIDENCIAL - CATALOGO DE CREATIVOS DE MARKETING', 50, 798)
           .text(`Página ${i + 1} de ${range.count}`, 300, 798, { align: 'right', width: 245 });
      }

      doc.end();
      stream.on('finish', () => resolve(Buffer.concat(chunks)));
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Keep compatibility signature for existing calls if any
   */
  async generateDummyPdf(title: string, agencyName: string = 'General'): Promise<Buffer> {
    // Generate basic analytics structure to feed the template
    const mockMetrics = {
      comparison: [
        { model: 'Jetour X70', sales3Months2026: 120, sales3Months2025: 100, growthRate: 20, june2025: 35, suggestedGoal2026: 42 },
        { model: 'Jetour Dashing', sales3Months2026: 80, sales3Months2025: 75, growthRate: 6, june2025: 25, suggestedGoal2026: 28 },
        { model: 'Soueast DX3', sales3Months2026: 60, sales3Months2025: 50, growthRate: 20, june2025: 18, suggestedGoal2026: 22 },
        { model: 'Soueast DX7', sales3Months2026: 45, sales3Months2025: 40, growthRate: 12, june2025: 15, suggestedGoal2026: 18 }
      ],
      totals: { sales3Months2026: 305, sales3Months2025: 265, growthRate: 15, june2025: 93, suggestedGoal2026: 110 }
    };
    const mockResearch = `
## Resumen de Campañas
Este es un reporte estratégico simulado para validación de formatos.

### Canales Digitales
Optimizar pauta en Google Search y Meta Ads.
    `;
    return this.generateExecutivePdf(title, agencyName, mockMetrics, mockResearch);
  }
}
