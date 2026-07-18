import { Test, TestingModule } from '@nestjs/testing';
import { PromptTemplateService } from './prompt-template.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PromptTemplateService (Versions and Rollback)', () => {
  let service: PromptTemplateService;
  let prisma: PrismaService;

  // Mock de PrismaService
  const mockPrismaService = {
    promptTemplate: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    promptVersion: {
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptTemplateService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<PromptTemplateService>(PromptTemplateService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('debe estar definido el servicio', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('debe actualizar el prompt y registrar una versión de historial', async () => {
      const mockPrompt = { id: 'uuid-1', key: 'test-key', name: 'Test', description: 'Desc', content: 'Old content' };
      const updateData = { name: 'Test Updated', content: 'New content', changeReason: 'Prueba de cambio' };

      mockPrismaService.promptTemplate.findUnique.mockResolvedValue(mockPrompt);
      mockPrismaService.promptTemplate.update.mockResolvedValue({ ...mockPrompt, ...updateData });
      mockPrismaService.promptVersion.count.mockResolvedValue(2); // 2 versiones previas
      mockPrismaService.promptVersion.create.mockResolvedValue({ id: 'v-3', version: 3 });

      const result = await service.update('test-key', updateData);

      expect(prisma.promptTemplate.findUnique).toHaveBeenCalledWith({ where: { key: 'test-key' } });
      expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
        where: { key: 'test-key' },
        data: {
          name: 'Test Updated',
          description: 'Desc',
          content: 'New content',
        },
      });
      expect(prisma.promptVersion.count).toHaveBeenCalledWith({ where: { promptTemplateId: 'uuid-1' } });
      expect(prisma.promptVersion.create).toHaveBeenCalledWith({
        data: {
          promptTemplateId: 'uuid-1',
          content: 'New content',
          version: 3,
          changeReason: 'Prueba de cambio',
        },
      });
      expect(result.content).toBe('New content');
    });
  });

  describe('findVersions', () => {
    it('debe retornar el historial de versiones ordenado descendentemente', async () => {
      const mockPrompt = { id: 'uuid-1', key: 'test-key' };
      const mockVersions = [
        { id: 'v-2', version: 2, content: 'v2 text' },
        { id: 'v-1', version: 1, content: 'v1 text' },
      ];

      mockPrismaService.promptTemplate.findUnique.mockResolvedValue(mockPrompt);
      mockPrismaService.promptVersion.findMany.mockResolvedValue(mockVersions);

      const result = await service.findVersions('test-key');

      expect(prisma.promptVersion.findMany).toHaveBeenCalledWith({
        where: { promptTemplateId: 'uuid-1' },
        orderBy: { version: 'desc' },
      });
      expect(result).toEqual(mockVersions);
    });
  });

  describe('rollback', () => {
    it('debe restaurar la plantilla al contenido de la versión y generar una nueva auditoría', async () => {
      const mockPrompt = { id: 'uuid-1', key: 'test-key', name: 'Test', content: 'Current text' };
      const mockVersionRecord = { id: 'version-uuid-1', promptTemplateId: 'uuid-1', content: 'Restore this text', version: 1 };

      mockPrismaService.promptTemplate.findUnique.mockResolvedValue(mockPrompt);
      mockPrismaService.promptVersion.findFirst.mockResolvedValue(mockVersionRecord);
      mockPrismaService.promptTemplate.update.mockResolvedValue({ ...mockPrompt, content: 'Restore this text' });
      mockPrismaService.promptVersion.count.mockResolvedValue(5);
      mockPrismaService.promptVersion.create.mockResolvedValue({});

      const result = await service.rollback('test-key', 'version-uuid-1');

      expect(prisma.promptVersion.findFirst).toHaveBeenCalledWith({
        where: { id: 'version-uuid-1', promptTemplateId: 'uuid-1' },
      });
      expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
        where: { key: 'test-key' },
        data: { content: 'Restore this text' },
      });
      expect(prisma.promptVersion.create).toHaveBeenCalledWith({
        data: {
          promptTemplateId: 'uuid-1',
          content: 'Restore this text',
          version: 6,
          changeReason: 'Rollback a versión 1',
        },
      });
      expect(result.content).toBe('Restore this text');
    });

    it('debe lanzar NotFoundException si la versión no corresponde al prompt', async () => {
      const mockPrompt = { id: 'uuid-1', key: 'test-key' };
      mockPrismaService.promptTemplate.findUnique.mockResolvedValue(mockPrompt);
      mockPrismaService.promptVersion.findFirst.mockResolvedValue(null);

      await expect(service.rollback('test-key', 'fake-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateSyntax', () => {
    it('debe pasar exitosamente con sintaxis correcta y limpia', () => {
      expect(() => service.validateSyntax('Hola {{ dealer_name }}, tu meta es {{ meta }}.')).not.toThrow();
    });

    it('debe lanzar BadRequestException si las llaves no están balanceadas', () => {
      expect(() => service.validateSyntax('Hola {{ dealer_name')).toThrow(BadRequestException);
      expect(() => service.validateSyntax('Hola dealer_name }}')).toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si hay un placeholder vacío', () => {
      expect(() => service.validateSyntax('Hola {{}}')).toThrow(BadRequestException);
      expect(() => service.validateSyntax('Hola {{   }}')).toThrow(BadRequestException);
    });

    it('debe lanzar BadRequestException si hay llaves anidadas o mal formadas', () => {
      expect(() => service.validateSyntax('Hola {{ foo {{ bar }} }}')).toThrow(BadRequestException);
    });
  });
});
