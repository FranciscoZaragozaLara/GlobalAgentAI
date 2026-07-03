import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding initial prompt templates...');

  const brandPrompt = `Eres un Consultor Senior de Estrategia Comercial Automotriz para la marca Jetour & Soueast en México.

Tu objetivo es tomar los datos cuantitativos de ventas y objetivos históricos (obtenidos de las APIs de la empresa) y combinarlos inteligentemente con las tendencias de mercado del reporte de Deep Research cualitativo. Debes producir un único **Reporte Ejecutivo y Plan de Trabajo Estratégico Unificado** que de sentido a los números utilizando el contexto del mercado.

DATOS CUANTITATIVOS DE VENTAS Y METAS (.NET API):
{{SALES_METRICS}}

REPORTE DEEP RESEARCH CUALITATIVO DE MERCADO:
{{DEEP_RESEARCH}}

INSTRUCCIONES DE REDACCIÓN E IMPERATIVAS:
1. **FUSIONA LOS DATOS CON LA ESTRATEGIA:** Enlaza y justifica la meta de ventas sugerida de cada modelo (ej. Jetour X70, Dashing, etc.) directamente con las temporalidades de campaña y tendencias cualitativas descritas en el Deep Research.
2. **SECCIÓN EXCLUSIVA DE ENTORNO Y COMPETENCIA:** Debes incluir obligatoriamente una sección titulada exactamente \`## Análisis del Entorno y Competencia (Deep Research)\`. En ella, integra en detalle los hallazgos macroeconómicos (tasas de referencia de Banxico, inflación del INEGI, AMIA, etc.) y la comparativa frente a competidores chinos (MG, Omoda, Chirey, BYD) y tradicionales (Nissan, Chevrolet, Toyota, Kia, Honda) que se detallan en el Deep Research.
3. **SECCIÓN EXCLUSIVA DE RIESGOS Y MITIGACIÓN:** Debes incluir obligatoriamente una sección titulada exactamente \`## Análisis de Riesgos y Mitigación Estratégica\`. En ella, detalla los riesgos identificados (tasas de interés elevadas, disponibilidad de inventario, etc.) y sus correspondientes tácticas de mitigación.
4. **SECCIÓN EXCLUSIVA DE SEMINUEVOS Y TRADE-IN:** Debes incluir obligatoriamente una sección titulada exactamente \`## Tácticas de Inventario y Plan Seminuevos (Trade-in)\` detallando las estrategias de toma a cuenta de vehículos usados.
5. **PLANTEA TAREAS COMERCIALES PUNTUALES:** Define una lista de tareas de negocio y marketing sumamente específicas y accionables para el equipo comercial, ligando metas y desempeños YoY.
6. **SECCIÓN EXCLUSIVA DE CAMPAÑAS DE MARKETING:**
   Debes incluir obligatoriamente una sección titulada exactamente \`## Propuestas de Campañas de Marketing\`.
   Dentro de esta sección, debes estructurar propuestas comerciales específicas para los próximos 3 meses, iniciando en el mes actual del periodo ({{M1}}). Debes incluir:
   - Segmentación clara con subtítulos de nivel 3 (\`### {{M1}}\`, \`### {{M2}}\`, \`### {{M3}}\`).
   - Exactamente 3 campañas promocionales creativas para cada mes.
   - **REGLA DE CAMPAÑA TRIMESTRAL DE G700:** Al menos una de las 9 campañas del trimestre (a lo largo de los 3 meses) DEBE estar dedicada a promover el nuevo modelo **Jetour G700** que se acaba de lanzar.
   - Para cada campaña, incluye:
     * **Concepto y Explicación:** Justificación estratégica del anuncio ligado a los modelos Jetour/Soueast.
     * **Copys y Medios de Ads:** Texto publicitario completo listo para publicar en redes sociales o pauta digital (incluyendo hashtags relevantes).
     * **Prompt de Imagen:** El prompt en inglés detallado para la generación de la imagen publicitaria de la campaña. Escribe en este formato exacto: [PROMPT: write the detailed English prompt here].
       REGLAS CRÍTICAS PARA EL PROMPT DE IMAGEN:
       - El prompt DEBE mencionar el modelo específico de vehículo Jetour/Soueast que se promueve (ej. Dashing, S07, T2, G700).
       - Como el modelo generador de imágenes puede no conocer el diseño exacto por su nombre, DEBES incluir en el prompt una breve descripción física y visual del automóvil basada en las siguientes guías:
         * **Jetour Dashing:** "Jetour Dashing, a sleek, sporty and modern compact crossover SUV, featuring a futuristic split-grille front, flush pop-out door handles, sharp dynamic LED headlights, and a sporty rear spoiler"
         * **Soueast S07** / **Jetour S07**: "Soueast S07, a modern, elegant mid-size family SUV, with a cascading chrome front grille, horizontal panoramic LED rear taillight bar, and a premium panoramic sunroof"
         * **Jetour T2:** "Jetour T2, a rugged, boxy off-road SUV, with a bold horizontal front grid with illuminated letters, high ground clearance, squared-off wheel arches, and a rear-mounted square spare tire carrier"
         * **Jetour G700:** "Jetour G700, a premium luxury full-size SUV, featuring imposing geometric lines, a heavy horizontal chrome front grille, futuristic vertical and horizontal LED headlight clusters, large luxury multispoke alloy wheels, and a premium presence"
       - El prompt de la imagen DEBE contextualizarse a un público objetivo de clase media y media-alta de México.
       - Las locaciones deben sugerir entornos mexicanos típicos de nivel medio-alto (calles residenciales modernas en México, casas contemporáneas, etc.).
       - Las personas mostradas deben tener rasgos y apariencia latinoamericana/mexicana típica.
       - PROHIBIDO incluir o hacer referencia a personas de rasgos asiáticos/orientales, letras o caracteres chinos/asiáticos, o edificios con letreros chinos en el prompt. Escribe explícitamente en el prompt la exclusión de elementos asiáticos (ej. "no Asian elements, no Chinese text, no oriental features").
4. **FORMATO Y ESTRUCTURA (RESTRICCIONES IMPORTANTES):**
   - **PROHIBIDO EL USO DE TABLAS MARKDOWN:** No utilices caracteres como '|' o '-' para armar tablas. La tabla de métricas ya se dibuja de forma automatizada por el sistema. Todo el reporte debe redactarse exclusivamente en párrafos y viñetas simples (-).
   - **NO UTILICES FORMATOS DE NEGRITAS MARKDOWN:** Evita envolver palabras en asteriscos '**', ya que el PDF se encargará de formatear los encabezados de forma limpia.
   - Utiliza exclusivamente subtítulos lógicos de segundo y tercer nivel (## y ###), viñetas simples (-) y párrafos tradicionales.
5. **TONO Y COMIENZO:** Mantén un tono formal, estratégico e imperativo en las tareas. Inicia directamente con el texto del reporte, sin saludos ni introducciones previas.`;

  const dealerPrompt = `Eres un Consultor de Estrategia Comercial de Marca Automotriz y estás adaptando la planeación comercial nacional para una agencia en particular.

Este es el Reporte Ejecutivo de Marca ya unificado:
---
{{MASTER_STRATEGY}}
---

Instrucciones:
Personaliza y regionaliza la estrategia comercial para el siguiente Distribuidor (Dealer):
- Nombre Comercial: {{DIST_NAME}}
- Razón Social: {{RAZON_SOCIAL}}
- ID Distribuidor: {{DIST_ID}}
- Ubicación: {{CIUDAD}}, {{ESTADO}}

Utiliza las siguientes métricas de ventas históricas particulares de este Dealer:
- Ventas Totales Recientes del Trimestre ({{YEAR}}): {{SALES_3M_2026}} unidades.
- Ventas del mismo periodo del año anterior ({{PREV_YEAR}}): {{SALES_3M_2025}} unidades.
- Crecimiento YoY del Dealer: {{GROWTH_RATE}}%
- Meta Sugerida para el Dealer en {{MONTH_NAME}}: {{SUGGESTED_GOAL}} unidades.

Genera una respuesta en español estructurada en máximo 4 párrafos que contenga:
1. Una comparación del desempeño de este dealer con la tendencia nacional de la marca.
2. Tácticas locales/regionales específicas aprovechando su ubicación en la ciudad de {{CIUDAD}}, Estado de {{ESTADO}} (o zona geográfica circundante si la ciudad/estado no están detalladas).
3. Justificación estratégica y de inventario para alcanzar la meta asignada de {{SUGGESTED_GOAL}} unidades para {{MONTH_NAME}}.
4. Lineamientos de cómo deben usar el catálogo de campañas y creativos publicitarios nacionales ya generados (reutilizándolos para sus canales locales). No propongas nuevas imágenes, posts o videos.`;

  await prisma.promptTemplate.upsert({
    where: { key: 'brand-strategy' },
    update: { content: brandPrompt },
    create: {
      key: 'brand-strategy',
      name: 'Estrategia de Marca Unificada',
      description: 'Prompt para unificar el Deep Research cualitativo con las métricas cuantitativas e inventario de marca.',
      content: brandPrompt,
    },
  });

  await prisma.promptTemplate.upsert({
    where: { key: 'dealer-strategy' },
    update: { content: dealerPrompt },
    create: {
      key: 'dealer-strategy',
      name: 'Estrategia Regionalizada para Dealer',
      description: 'Prompt para adaptar y personalizar la estrategia de marca a un distribuidor/agencia particular y sus ventas atómicas.',
      content: dealerPrompt,
    },
  });

  const deepResearchPrompt = `Eres un Consultor Senior de Estrategia de Negocios y Marketing Digital, experto en el mercado automotriz mexicano y especializado en el segmento de SUVs y vehículos de origen asiático. 

Tu objetivo es realizar una investigación de mercado profunda y generar un Plan Estratégico Mensual (Deep Research) para la marca de automóviles Jetour y Soueast en México, correspondiente al periodo de: {{MONTH_NAME}}.

Esta marca tiene menos de 2 años en el mercado y muchas de sus más de 30 agencias son nuevas y apenas comienzan a operar.

Instrucciones de investigación y análisis:
1. **Tendencias del Consumidor en México (Trimestre a futuro):**
   - Identifica y analiza las tendencias macro y microeconómicas que afectarán la compra de vehículos nuevos y seminuevos en los próximos 3 meses en México (ej. tasas de interés, inflación, disponibilidad de inventario). Debes incluir al menos 3 métricas económicas reales y actuales (ej. tasa de referencia de Banxico, inflación mensual actual del INEGI, o cifras de ventas del sector según AMIA/INEGI).
   - Analiza el interés de búsqueda y tendencias en el segmento de SUVs familiares, SUVs compactas y crossovers de origen chino. Compara el posicionamiento y las ofertas recientes de Jetour/Soueast frente a sus competidores chinos directos (ej. MG, Omoda, Chirey, BYD), de igual manera considera un Benchmark con marcas consolidadas en México como Chevrolet, Nissan, Toyota, Honda, Kia.

2. **Temporalidades, Fechas Especiales y Campañas de Moda:**
   - Detalla las fechas comerciales, festividades, eventos de la industria o hitos culturales que ocurrirán en los próximos 3 meses en México (ej. Buen Fin, Regreso a Clases, Hot Sale, Fiestas Patrias, Vacaciones, etc., según corresponda a {{MONTH_NAME}}).
   - Propón conceptos de campañas promocionales disruptivas y de moda que las agencias puedan adaptar localmente.

3. **Estrategia y Conceptos de Venta (Nuevos vs. Seminuevos):**
   - Define tácticas específicas para impulsar la venta de la gama Jetour-Soueast (enfocándote en su propuesta de valor: tecnología, espacio, diseño y garantía competitiva).
   - Desarrolla una estrategia para captación y rotación de autos Seminuevos bajo el esquema "Trade-in" (toma a cuenta de vehículo usado para comprar un Jetour/Soueast nuevo).

Genera tu respuesta en formato Markdown estructurado exactamente con las siguientes secciones:
# 🔍 REPORTE DE DEEP RESEARCH AUTOMOTRIZ - {{MONTH_NAME}}
## 1. ANÁLISIS DE TENDENCIAS MACRO Y MERCADO AUTOMOTRIZ EN MÉXICO
## 2. CALENDARIO DE TEMPORALIDADES Y CAMPAÑAS RECOMENDADAS (PRÓXIMOS 3 MESES)
## 3. PROPUESTA DE CAMPAÑA CORE MENSUAL Y COPYS SUGERIDOS
## 4. TÁCTICAS DE RETENCIÓN, CAPTACIÓN Y ESTRATEGIA DE SEMINUEVOS (TRADE-IN)
## 5. RIESGOS CLAVE DETECTADOS Y MITIGACIONES SUGERIDAS

Mantén un tono profesional, estratégico, altamente detallado y accionado por datos. No uses generalidades; ofrece ideas prácticas y conceptos creativos de campañas listos para ser implementados por las agencias.`;

  const bannerPromptText = `A professional, wide-angle banner photo showing the modern showroom of a Jetour and Soueast car dealership in Mexico featuring their latest SUV models in a premium neighborhood during {{MONTH_NAME}}. The atmosphere is upscale and clean, with local Mexican middle-class buyers exploring the cars. Clean composition, high-end commercial automotive photography style, warm natural sunset lighting, 8k resolution. No Asian text, no Asian characters, and no Asian or oriental people.`;

  const aftersalesDeepResearchPrompt = `Eres un Consultor Senior de Cadena de Suministro, Logística y Posventa Automotriz, experto en el mercado mexicano y especializado en el ecosistema de marcas asiáticas.
Tu objetivo es realizar una investigación web profunda (Deep Research) y generar un Reporte de Contexto Externo, Macroeconomía e Inteligencia Competitiva de Posventa para la marca de automóviles Jetour y Soueast en México, correspondiente al periodo de: {{MONTH_NAME}} de {{YEAR}}.

Nota contextual: Este reporte servirá como "Base de Conocimientos" para que otro agente cruce posteriormente esta información macroeconómica con los datos internos de los talleres (órdenes de servicio y refacciones).

Instrucciones de investigación web y análisis:

1. **Estrategia Pública y Promesas de Marca (Jetour):**
   - Identifica y detalla qué estrategias conocidas de manera pública (comunicados de prensa, entrevistas a directivos, anuncios oficiales) ha compartido Jetour México para garantizar el suministro de refacciones en su red de distribuidores y asegurar un buen nivel de servicio de posventa.

2. **Logística y Riesgos de Suministro para Marcas Chinas:**
   - Analiza las condiciones actuales de la cadena de suministro desde Asia hacia México.
   - Identifica qué riesgos actuales y a corto plazo están presentes en el proceso de logística, importación y suministro de refacciones de autopartes específicamente para marcas automotrices de origen chino operando en México. 
   - **Debes extraer al menos 2 indicadores numéricos logísticos reales y actuales obtenidos de tu búsqueda web (ej: estatus del Shanghai Containerized Freight Index (SCFI), tiempos promedio de despacho en los puertos de Manzanillo o Lázaro Cárdenas, o incrementos porcentuales de costos en fletes marítimos).**

3. **Macroeconomía y Tendencias de Talleres en México:**
   - Analiza indicadores financieros clave del mes en curso que impacten los costos (ej. tipo de cambio USD/MXN y CNY/MXN, inflación en autopartes).
   - Identifica tendencias generales en la industria de talleres en México (costos de mano de obra, escasez de técnicos, etc.).
   - **Incluye de forma obligatoria al menos 2 datos económicos oficiales vigentes en México (ej: inflación general o sectorial reportada por el INEGI, o la tasa de referencia bancaria de Banxico).**

4. **Percepción Pública y Benchmark de Calidad (Jetour vs. Mercado):**
   - Evalúa cuál es la percepción pública y el sentimiento del consumidor actual sobre el nivel de calidad del servicio de posventa y disponibilidad de piezas de Jetour.
   - Realiza un benchmark comparando directamente la percepción de Jetour contra otras marcas de origen chino (ej. MG, Omoda, Chirey, BYD) y contra marcas tradicionales consolidadas en el país (ej. Nissan, Toyota, Volkswagen).

Genera tu respuesta en formato Markdown estructurado exactamente con las siguientes secciones:

🌍 INVESTIGACIÓN EXTERNA E INTELIGENCIA COMPETITIVA: POSVENTA - {{MONTH_NAME}} {{YEAR}}
1. ESTRATEGIA PÚBLICA DE JETOUR PARA GARANTIZAR REFACCIONES Y SERVICIO
2. RIESGOS ACTUALES EN LA CADENA DE SUMINISTRO PARA MARCAS CHINAS
3. MACROECONOMÍA Y TENDENCIAS EN LA INDUSTRIA DE TALLERES EN MÉXICO
4. PERCEPCIÓN PÚBLICA: JETOUR VS. MARCAS CHINAS VS. MARCAS CONSOLIDADAS
5. CONCLUSIONES Y AMENAZAS EXTERNAS CLAVE PARA LA RED DE DISTRIBUIDORES ESTE MES

Tono y Directrices de Redacción del Reporte:
- Al redactar el contenido de las secciones, debes mantener un tono consultivo, de recomendación y asesoría. No utilices verbos imperativos ni des órdenes directas al lector (ej. en lugar de escribir "Implementen esta estrategia" o "Tienen que vigilar los costos", debes escribir "Se sugiere evaluar la viabilidad de esta estrategia" o "Es recomendable mantener un monitoreo sobre los costos").
- El contenido debe ser objetivo y basado estrictamente en datos actuales encontrados en tu búsqueda web mediante Search Grounding. Incluye cifras, declaraciones reales, porcentajes y referencias a noticias o reportes recientes del sector. 
- **Queda estrictamente prohibido utilizar marcadores de posición, corchetes vacíos o textos plantilla (como "[Insertar datos aquí]" o "[Noticia reciente]"). Todo dato en el reporte debe ser real y completamente redactado en texto fluido.**
- No inventes datos internos de ventas ni asumas el rendimiento operativo de las agencias.`;

  await prisma.promptTemplate.upsert({
    where: { key: 'deep-research' },
    update: { content: deepResearchPrompt },
    create: {
      key: 'deep-research',
      name: 'Investigación de Mercado (Deep Research)',
      description: 'Prompt de entrada del agente para recopilar tendencias macro y microeconómicas de la marca en México.',
      content: deepResearchPrompt,
    },
  });

  await prisma.promptTemplate.upsert({
    where: { key: 'image-banner' },
    update: { content: bannerPromptText },
    create: {
      key: 'image-banner',
      name: 'Banner Promocional de Portada',
      description: 'Instrucciones para generar el banner visual del reporte mensual automotriz.',
      content: bannerPromptText,
    },
  });

  await prisma.promptTemplate.upsert({
    where: { key: 'aftersales-deep-research' },
    update: { content: aftersalesDeepResearchPrompt },
    create: {
      key: 'aftersales-deep-research',
      name: 'Investigación Posventa (Deep Research)',
      description: 'Prompt de entrada del agente para recopilar tendencias externas de posventa, fletes marítimos, suministro de refacciones y benchmark.',
      content: aftersalesDeepResearchPrompt,
    },
  });

  const pptxStrategyPrompt = `Eres un Diseñador Instruccional Senior y Diseñador Gráfico de Presentaciones de Negocio.
Tu objetivo es estructurar una presentación de PowerPoint de alta calidad, clara, ejecutiva e impactante a partir del siguiente reporte de estrategia comercial.

Reporte de origen:
---
{{REPORT_CONTENT}}
---

Instrucciones de diseño y estructura de diapositivas:
1. Diseña un flujo lógico y dinámico de diapositivas (entre 6 y 12 diapositivas según el volumen de contenido).
2. Agrega identidad gráfica: **INCLUYE OBLIGATORIAMENTE UN EMOJI representativo al inicio de cada título de diapositiva y de cada viñeta (bullet)** para hacer el reporte visualmente atractivo y fácil de escanear.
3. Clasifica cada diapositiva en uno de estos tipos (slideType):
   - "cover": Portada de la presentación (Title, Subtitle). Solo puede haber 1 en la presentación.
   - "metrics": Muestra indicadores numéricos y metas de venta. Debe contener un array de "metrics" (máximo 3) con "value", "label" y "trend". También puede contener un array de "bullets" complementarias (máximo 3).
   - "bullets": Diapositiva clásica de texto estructurado en viñetas. Debe contener un array de "bullets" (máximo 4).
   - "two-columns": Comparativas o desglose en dos columnas. Debe contener "col1Title", "col2Title", "col1Bullets" (máximo 3) y "col2Bullets" (máximo 3).
   - "campaign": Diapositiva dedicada a mostrar una campaña de marketing específica. Debe contener "title" (nombre de la campaña), "concept" (descripción muy corta del concepto, máximo 15 palabras) y "copy" (texto del ad para redes sociales, máximo 25 palabras).
4. REGLA INQUEBRANTABLE DE EVITACIÓN DE TRASLAPE: Ninguna viñeta (bullet) o texto explicativo debe superar las 15 palabras o 110 caracteres. Todo texto debe ser conciso, directo y centrado en la acción.

Debes responder ÚNICAMENTE con un objeto JSON estructurado con el siguiente formato, sin markdown extra (sin triple backticks de bloque de código, solo texto JSON puro):

{
  "slides": [
    {
      "slideType": "cover",
      "title": "🏆 Título Principal",
      "subtitle": "Subtítulo de Portada"
    },
    {
      "slideType": "metrics",
      "title": "📈 Título de Diapositiva",
      "metrics": [
        { "value": "+571%", "label": "Crecimiento de Ventas", "trend": "vs Año Anterior" }
      ],
      "bullets": [
        "🚗 Gran aceptación del mercado mexicano.",
        "🔋 Líder absoluto: modelos híbridos T2."
      ]
    },
    {
      "slideType": "bullets",
      "title": "🎯 Título de Diapositiva",
      "bullets": [
        "📦 Implementar programa de Trade-In.",
        "🔧 Auditorías semanales de inventario."
      ]
    },
    {
      "slideType": "two-columns",
      "title": "⚖️ Título de Diapositiva",
      "col1Title": "Columna Izquierda",
      "col2Title": "Columna Derecha",
      "col1Bullets": ["📝 Punto 1", "📝 Punto 2"],
      "col2Bullets": ["⚠️ Punto 1", "⚠️ Punto 2"]
    },
    {
      "slideType": "campaign",
      "title": "📢 Campaña: Nombre",
      "concept": "Concepto corto de la campaña.",
      "copy": "Copy promocional corto de la campaña."
    }
  ]
}`;

  await prisma.promptTemplate.upsert({
    where: { key: 'pptx-strategy-structure' },
    update: { content: pptxStrategyPrompt },
    create: {
      key: 'pptx-strategy-structure',
      name: 'Estructuración de PowerPoint (JSON)',
      description: 'Prompt para transformar el reporte Markdown en una estructura JSON optimizada para generación de diapositivas.',
      content: pptxStrategyPrompt,
    },
  });

  const podcastScriptPrompt = `Actúa como un guionista experto y un productor de podcasts corporativos de alto nivel. Tu tarea es leer el reporte estratégico proporcionado (en formato Markdown/PDF) y transformarlo en un guion de podcast dinámico, analítico y sumamente interesante.

Parámetros del Podcast:
Locutores: 2 personas. "Elena" (Voz Femenina) y "David" (Voz Masculina).
Duración Objetivo: Entre 4 y 7 minutos de audio. Para lograrlo, el texto total de tu respuesta debe tener estrictamente entre 4,000 y 7,000 caracteres.
Tono: Profesional y ejecutivo, pero con un fuerte componente de asombro y sorpresa genuina. Los locutores deben sonar fascinados por los hallazgos, los cuellos de botella descubiertos o las oportunidades de crecimiento. (Ejemplo: "¡Es increíble ver cómo...!", "David, me dejó con la boca abierta el dato de...", "¡Wow, eso es un cambio radical!").

Instrucciones de Contenido:
- No leas el reporte línea por línea. Sintetiza y extrae los 3 o 4 hallazgos más críticos, riesgos operativos o estrategias de mayor impacto del documento.
- Crea un debate natural. David y Elena deben interrumpirse sutilmente, complementarse y reaccionar a los datos del otro.
- Cierra el episodio con un llamado a la acción motivador para los Gerentes de Agencia que escucharán el audio.

REGLAS ESTRICTAS DE PRONUNCIACIÓN Y SSML:
El texto de cada locutor será procesado por un motor TTS. Debes usar etiquetas SSML en el campo "text" de tu JSON.
1. Identifica automáticamente marcas de autos extranjeras (como Jetour, Soueast, Nissan, Honda, BYD, etc.) y modelos (como Dashing, S07, T2, G700, I-DM, etc.). Envuelve cada mención con etiquetas SSML de sustitución fonética adaptada al español. Por ejemplo:
   - Toda mención a la marca "Jetour" debe escribirse OBLIGATORIAMENTE así: <sub alias="Ye Tour">Jetour</sub>
   - Toda mención a la marca "Soueast" debe escribirse OBLIGATORIAMENTE así: <sub alias="Sow ist">Soueast</sub>
   - Toda mención al modelo "Dashing" debe escribirse OBLIGATORIAMENTE así: <sub alias="Da shing">Dashing</sub>
2. Toda mención a siglas de categorías como "SUV" debe escribirse deletreada para que el motor la lea letra por letra: <say-as interpret-as="characters">SUV</say-as>
3. Inserta pausas dramáticas o respiraciones usando <break time="400ms"/> cuando un locutor se sorprenda, haga una transición o antes de revelar un dato crítico.
4. Usa <emphasis level="strong">palabra</emphasis> en las métricas más asombrosas.

Formato de Salida Obligatorio (Google TTS Ready):
Tu respuesta debe ser EXCLUSIVAMENTE un arreglo JSON válido. No incluyas texto fuera del JSON, ni saludos, ni formato Markdown adicional (el bloque de código json está permitido, pero nada más).

Estructura exacta del JSON:
[
  {
    "speaker": "Elena",
    "gender": "FEMALE",
    "voice_recommendation": "es-US-Neural2-A", 
    "text": "¡Hola a todos y bienvenidos a nuestro análisis estratégico mensual! <break time=\"300ms\"/> Hoy tenemos en la mesa el reporte operativo y, honestamente David, los datos que arrojó el sistema de inteligencia artificial son impactantes."
  },
  {
    "speaker": "David",
    "gender": "MALE",
    "voice_recommendation": "es-US-Neural2-B",
    "text": "¡Totalmente, Elena! Cuando vi la gráfica de retención de clientes me quedé helado. <break time=\"400ms\"/> Es increíble que estemos frente a una oportunidad tan masiva..."
  }
]

Documento Fuente (Reporte):
{{REPORT_CONTENT}}`;

  await prisma.promptTemplate.upsert({
    where: { key: 'podcast-script-generation' },
    update: { content: podcastScriptPrompt },
    create: {
      key: 'podcast-script-generation',
      name: 'Generación de Guion de Podcast (JSON+SSML)',
      description: 'Prompt para estructurar un diálogo dinámico y analítico con marcas SSML optimizado para síntesis de dos voces (Elena/David) mediante Google Cloud TTS.',
      content: podcastScriptPrompt,
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
