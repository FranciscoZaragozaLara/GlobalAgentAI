import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PromptTemplateService {
  private readonly logger = new Logger(PromptTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all prompts
   */
  async findAll() {
    return await this.prisma.promptTemplate.findMany({
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Find a prompt by its unique key
   */
  async findByKey(key: string) {
    const prompt = await this.prisma.promptTemplate.findUnique({
      where: { key },
    });

    if (!prompt) {
      throw new NotFoundException(`Prompt template with key '${key}' not found`);
    }

    return prompt;
  }

  /**
   * Update prompt content
   */
  async update(key: string, data: { name?: string; description?: string; content: string }) {
    const prompt = await this.findByKey(key);

    return await this.prisma.promptTemplate.update({
      where: { key },
      data: {
        name: data.name ?? prompt.name,
        description: data.description ?? prompt.description,
        content: data.content,
      },
    });
  }

  /**
   * Fetch a prompt by key, and replace {{PLACEHOLDER}} style variables dynamically
   */
  async resolvePrompt(key: string, variables: Record<string, string | number>): Promise<string> {
    const prompt = await this.findByKey(key);
    let resolvedContent = prompt.content;

    for (const [vKey, vVal] of Object.entries(variables)) {
      // Replace all occurrences of {{vKey}}
      const regex = new RegExp(`{{\\s*${vKey}\\s*}}`, 'gi');
      resolvedContent = resolvedContent.replace(regex, vVal.toString());
    }

    return resolvedContent;
  }
}
