import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(executionContext: ExecutionContext): boolean {
    const request = executionContext.switchToHttp().getRequest();
    
    // Extraer cabeceras de rol y autorización
    const roleHeader = request.headers['x-user-role'];
    const authHeader = request.headers['authorization'];

    // Clave secreta administrativa desde el .env
    const configuredApiKey = this.configService.get<string>('ADMIN_API_KEY', 'admin-secret-key-123');

    // Validación: Rol de administrador explícito o token de autorización
    if (roleHeader === 'admin') {
      return true;
    }

    if (authHeader && authHeader === `Bearer ${configuredApiKey}`) {
      return true;
    }

    throw new UnauthorizedException('Access denied: Administrative privileges required.');
  }
}
