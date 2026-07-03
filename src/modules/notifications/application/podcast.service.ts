import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GeminiService } from '../../gemini/application/gemini.service';
import * as textToSpeech from '@google-cloud/text-to-speech';
import * as path from 'path';
import * as fs from 'fs';

export interface PodcastTurn {
  speaker: string;
  gender: 'FEMALE' | 'MALE';
  voice_recommendation?: string;
  text: string;
}

@Injectable()
export class PodcastService {
  private readonly logger = new Logger(PodcastService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Generates the dialogue script JSON from a markdown strategy report
   */
  async generatePodcastScript(reportContent: string): Promise<PodcastTurn[]> {
    this.logger.log('Fetching podcast dialogue script template from DB...');
    const template = await this.prisma.promptTemplate.findUnique({
      where: { key: 'podcast-script-generation' },
    });

    if (!template) {
      throw new Error('Prompt template "podcast-script-generation" was not found in the database. Please run seeder.');
    }

    const prompt = template.content.replace('{{REPORT_CONTENT}}', reportContent);
    
    this.logger.log('Calling Gemini 3.5 Flash to generate podcast script with SSML tags...');
    const rawResponse = await this.geminiService.generateText(prompt, 'gemini-3.5-flash');

    // Parse the JSON array safely
    const firstBrace = rawResponse.indexOf('[');
    if (firstBrace === -1) {
      throw new Error('No valid JSON array found in Gemini response.');
    }

    const possibleEnds: number[] = [];
    let pos = rawResponse.indexOf(']', firstBrace);
    while (pos !== -1) {
      possibleEnds.push(pos);
      pos = rawResponse.indexOf(']', pos + 1);
    }

    let parsedTurns: PodcastTurn[] = [];
    let parsed = false;

    for (let i = possibleEnds.length - 1; i >= 0; i--) {
      try {
        const candidate = rawResponse.substring(firstBrace, possibleEnds[i] + 1);
        parsedTurns = JSON.parse(candidate);
        parsed = true;
        break;
      } catch (e) {
        // Continue backtracking
      }
    }

    if (!parsed || !Array.isArray(parsedTurns)) {
      throw new Error(`Failed to parse dialogue script JSON from response: ${rawResponse}`);
    }

    this.logger.log(`Successfully generated podcast script containing ${parsedTurns.length} dialogue turns.`);
    return parsedTurns;
  }

  /**
   * Synthesizes dialogue turns using Google Cloud TTS SDK and returns a concatenated MP3 buffer
   */
  async synthesizePodcast(turns: PodcastTurn[]): Promise<Buffer> {
    this.logger.log('Initializing Google Cloud Text-to-Speech Client...');
    
    // Resolve credentials path from env if set
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!path.isAbsolute(credPath)) {
        const absoluteCredPath = path.join(process.cwd(), credPath);
        process.env.GOOGLE_APPLICATION_CREDENTIALS = absoluteCredPath;
        this.logger.log(`Resolved absolute GOOGLE_APPLICATION_CREDENTIALS: ${absoluteCredPath}`);
      }
    }

    const ttsClient = new textToSpeech.TextToSpeechClient();
    const audioBuffers: Buffer[] = [];

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      // Select appropriate voice based on gender
      const voiceName = turn.gender === 'FEMALE' ? 'es-US-Neural2-A' : 'es-US-Neural2-B';

      this.logger.log(`Synthesizing turn ${i + 1}/${turns.length} [Speaker: ${turn.speaker} | Voice: ${voiceName}]...`);

      const sanitizedText = this.sanitizeSsmlText(turn.text);
      const request = {
        input: { ssml: `<speak>${sanitizedText}</speak>` },
        voice: {
          languageCode: 'es-US',
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: 'MP3' as const,
          speakingRate: 1.0,
          pitch: 0.0,
        },
      };

      try {
        const [response] = await ttsClient.synthesizeSpeech(request);
        if (response && response.audioContent) {
          audioBuffers.push(Buffer.from(response.audioContent as Uint8Array));
        } else {
          throw new Error('Empty audioContent returned from TTS API');
        }
      } catch (err) {
        this.logger.warn(`Failed to synthesize dialogue turn ${i + 1}: ${err.message}. Raw text was: "${turn.text}" | Sanitized SSML: "${request.input.ssml}"`);
        throw new Error(`TTS Synthesis failed at turn ${i + 1}: ${err.message}`);
      }
    }

    if (audioBuffers.length === 0) {
      throw new Error('No audio buffers were generated.');
    }

    this.logger.log(`Concatenating ${audioBuffers.length} audio buffers...`);
    return Buffer.concat(audioBuffers);
  }

  private sanitizeSsmlText(text: string): string {
    if (!text) return '';
    // Replace unescaped & with &amp;
    return text.replace(/&(?![a-zA-Z0-9#]+;)/g, '&amp;');
  }
}
