import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  async update(key: string, data: { name?: string; description?: string; content: string; changeReason?: string }) {
    // Validar sintaxis de placeholders
    this.validateSyntax(data.content);

    const prompt = await this.findByKey(key);

    const updated = await this.prisma.promptTemplate.update({
      where: { key },
      data: {
        name: data.name ?? prompt.name,
        description: data.description ?? prompt.description,
        content: data.content,
      },
    });

    // Determinar número de la siguiente versión
    const versionCount = await this.prisma.promptVersion.count({
      where: { promptTemplateId: prompt.id },
    });

    // Guardar registro de versión
    await this.prisma.promptVersion.create({
      data: {
        promptTemplateId: prompt.id,
        content: data.content,
        version: versionCount + 1,
        changeReason: data.changeReason ?? 'Actualización de plantilla',
      },
    });

    return updated;
  }

  /**
   * List all versions for a given prompt template
   */
  async findVersions(key: string) {
    const prompt = await this.findByKey(key);
    return await this.prisma.promptVersion.findMany({
      where: { promptTemplateId: prompt.id },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Rollback a prompt template to a previous version
   */
  async rollback(key: string, versionId: string) {
    const prompt = await this.findByKey(key);

    const versionRecord = await this.prisma.promptVersion.findFirst({
      where: { id: versionId, promptTemplateId: prompt.id },
    });

    if (!versionRecord) {
      throw new NotFoundException(`Version record with ID '${versionId}' not found for prompt template '${key}'`);
    }

    const updated = await this.prisma.promptTemplate.update({
      where: { key },
      data: {
        content: versionRecord.content,
      },
    });

    const versionCount = await this.prisma.promptVersion.count({
      where: { promptTemplateId: prompt.id },
    });

    await this.prisma.promptVersion.create({
      data: {
        promptTemplateId: prompt.id,
        content: versionRecord.content,
        version: versionCount + 1,
        changeReason: `Rollback a versión ${versionRecord.version}`,
      },
    });

    return updated;
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

  /**
   * Validate double brace placeholder syntax inside prompt content
   */
  validateSyntax(content: string): void {
    const openCount = (content.match(/{{\s*/g) || []).length;
    const closeCount = (content.match(/\s*}}/g) || []).length;

    if (openCount !== closeCount) {
      throw new BadRequestException(`Syntax Error: Mismatched double braces (Found ${openCount} '{{' and ${closeCount} '}}')`);
    }

    if (/{{\s*}}/.test(content)) {
      throw new BadRequestException('Syntax Error: Empty placeholder detected ({{ }})');
    }

    const regex = /{{(.*?)}}/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const inner = match[1];
      if (inner.includes('{{') || inner.includes('}}')) {
        throw new BadRequestException(`Syntax Error: Nested braces or unclosed placeholder detected inside: '{{${inner}}}'`);
      }
    }
  }
}
