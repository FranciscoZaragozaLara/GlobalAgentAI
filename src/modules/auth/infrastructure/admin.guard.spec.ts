import { Test, TestingModule } from '@nestjs/testing';
import { AdminGuard } from './admin.guard';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let configService: ConfigService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue('my-secret-admin-key'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminGuard,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    guard = module.get<AdminGuard>(AdminGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  const createMockExecutionContext = (headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
        }),
      }),
    } as any;
  };

  it('debe estar definido', () => {
    expect(guard).toBeDefined();
  });

  it('debe retornar true si la cabecera x-user-role es admin', () => {
    const context = createMockExecutionContext({ 'x-user-role': 'admin' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('debe retornar true si el Bearer token coincide con ADMIN_API_KEY', () => {
    const context = createMockExecutionContext({ authorization: 'Bearer my-secret-admin-key' });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('debe lanzar UnauthorizedException si no se envían cabeceras válidas', () => {
    const context = createMockExecutionContext({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('debe lanzar UnauthorizedException si el rol o la clave son inválidos', () => {
    const context = createMockExecutionContext({ 'x-user-role': 'user', authorization: 'Bearer wrong-key' });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
