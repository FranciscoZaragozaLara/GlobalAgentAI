import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import * as crypto from 'crypto';


@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private ai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.error('GEMINI_API_KEY is not defined in env variables.');
    }
    // Initialize the official Google Gen AI SDK
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generates content using a specific Gemini model
   */
  async generateText(prompt: string, model: string = 'gemini-2.5-pro'): Promise<string> {
    try {
      this.logger.log(`Invoking Gemini Model: ${model}...`);
      
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          // Low temperature is ideal for data analysis/structuring tasks
          temperature: 0.2, 
        }
      });

      if (!response.text) {
        throw new Error('Gemini API returned an empty text response.');
      }

      this.logger.log('Gemini response successfully received.');
      return response.text;
    } catch (error) {
      this.logger.error(`Error calling Gemini API: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Runs Deep Research using basic model or background interaction agents (Intermediate / Advanced)
   */
  async generateDeepResearch(
    prompt: string,
    mode: string = 'Basica',
  ): Promise<string> {
    const uppercaseMode = mode.toUpperCase() === 'AVANZADA' ? 'Avanzada' : (mode.toUpperCase() === 'INTERMEDIA' ? 'Intermedia' : 'Basica');
    const startTime = new Date();
    const promptHash = crypto.createHash('md5').update(prompt.trim().toLowerCase()).digest('hex');

    let outputText = '';
    let modelOrAgentUsed = '';
    let interactionId = 'N/A';

    if (uppercaseMode === 'Basica') {
      this.logger.log('Starting Basic Deep Research using gemini-2.5-pro...');
      modelOrAgentUsed = 'gemini-2.5-pro';
      outputText = await this.generateText(prompt, 'gemini-2.5-pro');
    } else {
      const agentName = uppercaseMode === 'Avanzada' ? 'deep-research-max-preview-04-2026' : 'deep-research-preview-04-2026';
      modelOrAgentUsed = agentName;
      this.logger.log(`Starting ${uppercaseMode} Deep Research in background via agent ${agentName}...`);

      try {
        const client = this.ai as any;
        if (!client.interactions) {
          throw new Error('SDK client.interactions is not supported in this runtime.');
        }

        let interaction = await client.interactions.create({
          agent: agentName,
          input: prompt,
          background: true,
        });

        interactionId = interaction.id;
        this.logger.log(`Interaction created successfully. ID: ${interaction.id}. Polling for status...`);

        let attempts = 0;
        const maxAttempts = 90; // 90 * 10 seconds = 15 minutes max
        while (interaction.status !== 'completed' && interaction.status !== 'failed') {
          attempts++;
          if (attempts > maxAttempts) {
            throw new Error(`Deep Research execution timed out after 15 minutes (Interaction ID: ${interaction.id}).`);
          }
          this.logger.log(`Agent task status: ${interaction.status} (Attempt ${attempts}/${maxAttempts}). Waiting 10 seconds before polling...`);
          await new Promise((resolve) => setTimeout(resolve, 10000));
          interaction = await client.interactions.get(interaction.id);
        }

        if (interaction.status === 'completed') {
          this.logger.log(`Deep Research successfully completed. Output length: ${interaction.output_text?.length || 0}`);
          
          let fullText = '';
          if (interaction.steps && Array.isArray(interaction.steps)) {
            const modelOutputs = interaction.steps.filter((s: any) => s.type === 'model_output');
            for (const step of modelOutputs) {
              if (Array.isArray(step.content)) {
                for (const item of step.content) {
                  if (item.type === 'text' && item.text) {
                    if (fullText && !fullText.endsWith('\n') && !item.text.startsWith('\n')) {
                      fullText += '\n\n';
                    }
                    fullText += item.text;
                  }
                }
              }
            }
          }
          
          outputText = fullText || interaction.output_text || '';
          this.logger.log(`Reconstructed full output from steps. Total length: ${outputText.length}`);
        } else {
          const errorMsg = interaction.error || 'Unknown error occurred in background research';
          throw new Error(`Background research failed: ${JSON.stringify(errorMsg)}`);
        }
      } catch (error) {
        this.logger.error(`Error in generateDeepResearch (${uppercaseMode}): ${error.message}`, error.stack);
        throw error;
      }
    }

    const endTime = new Date();
    const durationSeconds = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
    const outputHash = crypto.createHash('md5').update(outputText.trim().toLowerCase()).digest('hex');

    const metadataHeader = `---
METADATA DE INVESTIGACIÓN (TRACKING)
------------------------------------
Modalidad/Estrategia: ${uppercaseMode}
Modelo/Agente Usado: ${modelOrAgentUsed}
ID de Interacción: ${interactionId}
Fecha de Investigación: ${startTime.toISOString()}
Duración de Investigación: ${durationSeconds} segundos
Hash del Prompt: ${promptHash}
Hash de Respuesta: ${outputHash}
---

`;

    return metadataHeader + outputText;
  }

  /**
   * Generates an image using Google Imagen 3
   */
  async generateImage(prompt: string, model: string = 'imagen-4.0-generate-001'): Promise<Buffer> {
    try {
      this.logger.log(`Invoking Imagen Model: ${model} with prompt: ${prompt}...`);
      const response = await this.ai.models.generateImages({
        model: model,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '16:9', // perfect aspect ratio for widescreen ads
        }
      });

      const firstImage = response.generatedImages?.[0];
      if (!firstImage || !firstImage.image || !firstImage.image.imageBytes) {
        throw new Error('Imagen API did not return valid image bytes.');
      }

      const base64Bytes = firstImage.image.imageBytes;
      return Buffer.from(base64Bytes, 'base64');
    } catch (error) {
      this.logger.error(`Error calling Imagen API: ${error.message}`, error.stack);
      throw error;
    }
  }
}
