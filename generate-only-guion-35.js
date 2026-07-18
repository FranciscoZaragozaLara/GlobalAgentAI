const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const artifactPath = 'C:\\Users\\zilph\\.gemini\\antigravity\\brain\\89bdf2a7-3425-420f-b715-7dd9c8b84c32\\guion_podcast_generado.json';

const mockReport = `# PLAN ESTRATÉGICO DE VENTAS - JUNIO 2026

## 1. Análisis de Tendencias de Mercado y Ventas
- Crecimiento YoY del 571.18% en el trimestre actual, alcanzando 1,141 unidades acumuladas.
- La SUV familiar Jetour T2 I-DM es el modelo más vendido con 246 unidades.
- Las tasas de interés elevadas en México de Banxico representan una amenaza constante al financiamiento.

## 2. Campañas de Temporada
- "Operación Upgrade Papá": Foco en la T2 para el Día del Padre en Junio.
- "Verano Sin Escalas": Campaña de vacaciones promoviendo la Jetour Dashing.

## 3. Retos y Trade-In
- Implementar el Plan Evoluciona Jetour de Trade-In para renovar inventario de seminuevos.
- Baja disponibilidad del modelo Jetour S07.`;

async function main() {
  console.log('Generating podcast script with Gemini 3.5 Flash...');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  let reportText = mockReport;
  const realReportPath = path.join(__dirname, 'data', 'unified', 'unified-report-basica-jetoursoueastdealerdemo-junio2026-2026.md');
  if (fs.existsSync(realReportPath)) {
    reportText = fs.readFileSync(realReportPath, 'utf8');
  }

  const prompt = `Actúa como un guionista experto y un productor de podcasts corporativos de alto nivel. Tu tarea es leer el reporte estratégico proporcionado (en formato Markdown/PDF) y transformarlo en un guion de podcast dinámico, analítico y sumamente interesante.

Parámetros del Podcast:
Locutores: 2 personas. "Elena" (Voz Femenina) y "David" (Voz Masculina).
Duración Objetivo: Entre 4 y 7 minutos de audio. Para lograrlo, el texto total de tu respuesta debe tener estrictamente entre 4,000 y 7,000 caracteres.
Tono: Profesional y ejecutivo, pero con un fuerte componente de asombro y sorpresa genuina. Los locutores deben sonar fascinados por los hallazgos, los cuellos de botella descubiertos o las oportunidades de crecimiento. (Ejemplo: "¡Es increíble ver cómo...!", "David, me dejó con la boca abierta el dato de...", "¡Wow, eso es un cambio radical!").

Instrucciones de Contenido:
- No leas el reporte línea por línea. Sintetiza y extrae los 3 o 4 hallazgos más críticos, riesgos operativos o estrategias de mayor impacto del documento.
- Crea un debate natural. David y Elena deben interrumpirse sutilmente, complementarse y reaccionar a los datos del otro.
- Cierra el episodio con un llamado a la acción motivador para los Gerentes de Agencia que escucharán el audio.

Formato de Salida Obligatorio (Google TTS Ready):
Tu respuesta debe ser EXCLUSIVAMENTE un arreglo JSON válido. No incluyas texto fuera del JSON, ni saludos, ni formato Markdown adicional (el bloque de código json está permitido, pero nada más).

Estructura exacta del JSON:
[
  {
    "speaker": "Elena",
    "gender": "FEMALE",
    "voice_recommendation": "es-US-Neural2-A", 
    "text": "¡Hola a todos y bienvenidos a nuestro análisis estratégico mensual! Hoy tenemos en la mesa el reporte operativo y, honestamente David, los datos que arrojó el sistema de inteligencia artificial son impactantes."
  },
  {
    "speaker": "David",
    "gender": "MALE",
    "voice_recommendation": "es-US-Neural2-B",
    "text": "¡Totalmente, Elena! Cuando vi la gráfica de retención de clientes me quedé helado. Es increíble que estemos frente a una oportunidad tan masiva..."
  }
]

Documento Fuente (Reporte):
${reportText}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config: { temperature: 0.3 }
    });

    const responseText = response.text || '';
    
    // Parse JSON safely using backtracking block boundaries locator
    const firstBrace = responseText.indexOf('[');
    if (firstBrace === -1) throw new Error('No JSON array opening found');
    const possibleEnds = [];
    let pos = responseText.indexOf(']', firstBrace);
    while (pos !== -1) {
      possibleEnds.push(pos);
      pos = responseText.indexOf(']', pos + 1);
    }
    
    let parsedText = '';
    for (let i = possibleEnds.length - 1; i >= 0; i--) {
      try {
        const candidate = responseText.substring(firstBrace, possibleEnds[i] + 1);
        JSON.parse(candidate); // check validity
        parsedText = candidate;
        break;
      } catch (e) {}
    }
    
    if (!parsedText) {
      throw new Error(`Could not parse JSON. Raw Output:\n${responseText}`);
    }

    fs.writeFileSync(artifactPath, parsedText);
    console.log(`Guion guardado exitosamente en: ${artifactPath}`);

  } catch (err) {
    console.error('Failed to generate dialogue script:', err.message);
  }
}

main();
