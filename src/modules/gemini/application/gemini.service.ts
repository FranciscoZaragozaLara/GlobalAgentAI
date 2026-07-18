import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';


@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private ai: GoogleGenAI;

  constructor(private readonly configService: ConfigService) {
    const credentialsPath = this.configService.get<string>('GOOGLE_APPLICATION_CREDENTIALS');
    let useVertex = false;
    let projectId = '';

    if (credentialsPath) {
      const fullPath = path.isAbsolute(credentialsPath)
        ? credentialsPath
        : path.join(process.cwd(), credentialsPath);
      if (fs.existsSync(fullPath)) {
        try {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
          const creds = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
          if (creds.project_id) {
            projectId = creds.project_id;
            useVertex = true;
            process.env.GOOGLE_APPLICATION_CREDENTIALS = fullPath;
          }
        } catch (e: any) {
          this.logger.error(`Error reading Google Credentials JSON: ${e.message}`);
        }
      }
    }

    if (useVertex) {
      this.logger.log(`Initializing GoogleGenAI in Vertex AI mode for project: ${projectId}...`);
      this.ai = new GoogleGenAI({
        vertexai: true,
        project: projectId,
        location: 'global',
      });
    } else {
      const apiKey = this.configService.get<string>('GEMINI_API_KEY');
      if (!apiKey) {
        this.logger.error('GEMINI_API_KEY is not defined in env variables.');
      }
      this.logger.log('Initializing GoogleGenAI in Developer API mode using API Key...');
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  /**
   * Generates content using a specific Gemini model
   */
  async generateText(prompt: string, model: string = 'gemini-3.1-pro'): Promise<string> {
    try {
      let activeModel = model;
      if (activeModel === 'gemini-3.1-pro') {
        activeModel = 'gemini-3.1-pro-preview';
      }
      this.logger.log(`Invoking Gemini Model: ${activeModel} (requested: ${model})...`);
      
      const response = await this.ai.models.generateContent({
        model: activeModel,
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
      const isNotFoundError = error.message && (
        error.message.includes('not found') || 
        error.message.includes('404') || 
        error.message.includes('does not have access')
      );

      if (isNotFoundError) {
        const fallbackModel = model.includes('pro') ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
        this.logger.warn(`Model ${model} is not available on your Vertex AI project. Falling back to ${fallbackModel}...`);
        
        try {
          const response = await this.ai.models.generateContent({
            model: fallbackModel,
            contents: prompt,
            config: {
              temperature: 0.2,
            }
          });

          if (!response.text) {
            throw new Error('Gemini API returned an empty text response.');
          }

          this.logger.log(`Gemini response successfully received using fallback model ${fallbackModel}.`);
          return response.text;
        } catch (fallbackError) {
          this.logger.error(`Error calling fallback model ${fallbackModel}: ${fallbackError.message}`, fallbackError.stack);
          throw fallbackError;
        }
      }

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
      this.logger.log('Starting Basic Deep Research using gemini-3.1-pro...');
      modelOrAgentUsed = 'gemini-3.1-pro';
      outputText = await this.generateText(prompt, 'gemini-3.1-pro');
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

  async generateImage(prompt: string, model: string = 'gemini-3.1-flash-image'): Promise<Buffer> {
    try {
      this.logger.log(`Invoking Gemini Image Model: ${model} with prompt: ${prompt}...`);
      const response = await this.ai.models.generateContent({
        model: model,
        contents: prompt,
      });

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData && p.inlineData.data);
      if (!part || !part.inlineData || !part.inlineData.data) {
        this.logger.error(`Gemini Image API response structure: ${JSON.stringify(response)}`);
        throw new Error('Gemini Image API did not return valid image bytes.');
      }

      const base64Bytes = part.inlineData.data;
      return Buffer.from(base64Bytes, 'base64');
    } catch (error) {
      this.logger.error(`Error calling Gemini Image API: ${error.message}`, error.stack);
      throw error;
    }
  }
}
