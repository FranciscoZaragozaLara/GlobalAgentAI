import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';

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
   * Generates an image using Google Imagen 3
   */
  async generateImage(prompt: string, model: string = 'imagen-3.0-generate-002'): Promise<Buffer> {
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
