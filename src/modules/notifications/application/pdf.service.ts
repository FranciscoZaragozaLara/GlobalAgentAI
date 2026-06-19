import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');
import { Writable } from 'stream';

@Injectable()
export class PdfService {
  /**
   * Generates a dummy PDF as a Buffer using PDFKit
   */
  async generateDummyPdf(title: string, agencyName: string = 'General'): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      const stream = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      doc.pipe(stream);

      // --- PDF Header ---
      doc.fillColor('#1A365D')
         .fontSize(22)
         .text('JETOUR SOUEAST MÉXICO', { align: 'center' });
      
      doc.fillColor('#4A5568')
         .fontSize(14)
         .text(`Plan Estratégico de Ventas y Marketing - ${title}`, { align: 'center' });
      
      doc.moveDown(1.5);

      // --- Meta details ---
      doc.fontSize(10)
         .fillColor('#718096')
         .text(`Agencia: ${agencyName}`)
         .text(`Fecha de Generación: ${new Date().toLocaleDateString()}`)
         .text('Versión: 1.0 (Borrador de Prueba)');
      
      doc.moveDown(2);
      
      // --- Section: Propuesta de Valor ---
      doc.fontSize(14)
         .fillColor('#2B6CB0')
         .text('1. Propuesta de Trabajo y Ventas (Dummy)', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.fontSize(11)
         .fillColor('#2D3748')
         .text(
           'Este documento es una simulación en PDF para el script de demo. En el ambiente productivo, ' +
           'este archivo contendrá análisis estadísticos completos, tendencias detectadas de DeepResearch, ' +
           'gráficos comparativos de ventas y proyecciones estratégicas individuales por agencia.'
         );
      
      doc.moveDown(1);
      
      // --- Bullet points ---
      doc.text('• Acciones clave para incrementar el tráfico de prospectos en sala.');
      doc.text('• Ajustes sugeridos en campañas de marketing digital para seminuevos.');
      doc.text('• Mitigación de riesgos detectados en el abastecimiento de unidades.');

      doc.moveDown(2);

      // --- Footer / Signature ---
      doc.fontSize(9)
         .fillColor('#A0AEC0')
         .text('© 2026 Jetour-Soueast México. Todos los derechos reservados.', { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }
}
