import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AuthSession } from '../domain/auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  
  // Keep the session in memory. In a multi-instance env, this could be migrated to Redis.
  private currentSession: AuthSession | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Retrieves a valid JWT Token, logging in if there is no session or if the session has expired
   */
  async getValidToken(): Promise<string> {
    if (this.currentSession && !this.isTokenExpired(this.currentSession)) {
      this.logger.log('Reusing existing valid JWT Token.');
      return this.currentSession.token;
    }

    this.logger.log('No valid session found or token has expired. Logging in to Global DMS...');
    const session = await this.login();
    this.currentSession = session;
    return session.token;
  }

  /**
   * Checks if token will expire in the next 5 minutes
   */
  private isTokenExpired(session: AuthSession): boolean {
    const bufferTime = 5 * 60 * 1000; // 5 minutes buffer
    const now = Date.now();
    return now + bufferTime >= session.expiresAt;
  }

  /**
   * Performs the actual HTTP POST authentication request to Global DMS
   */
  private async login(): Promise<AuthSession> {
    const baseUrl = this.configService.get<string>('GLOBAL_DMS_BASE_URL', 'https://www.globaldms.mx/globalapiOracle');
    const usuario = this.configService.get<string>('GLOBAL_DMS_USER');
    const password = this.configService.get<string>('GLOBAL_DMS_PASS');
    const empresaId = this.configService.get<string>('GLOBAL_DMS_EMPRESA', '1');
    const agenciaId = this.configService.get<string>('GLOBAL_DMS_AGENCIA', '1');

    if (!usuario || !password) {
      throw new Error('GLOBAL_DMS_USER or GLOBAL_DMS_PASS are not configured in environment.');
    }

    try {
      const url = `${baseUrl}/usuario`;
      const payload = {
        usuario,
        password,
        empresaId,
        agenciaId,
        usuarioID: '',
        token: '',
        nombreUsuario: '',
        nombreAgencia: '',
        urlImagen: '',
      };

      let response;
      let attempts = 0;
      const maxAttempts = 3;
      let delay = 1000;

      while (attempts < maxAttempts) {
        try {
          attempts++;
          response = await axios.post(url, payload, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/plain',
            },
            timeout: 15000,
          });
          break;
        } catch (err) {
          this.logger.warn(`Auth connection attempt ${attempts} failed: ${err.message}.`);
          if (attempts >= maxAttempts) {
            throw err;
          }
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        }
      }

      if (response.data && response.data.response === 'OK' && response.data.results) {
        const results = response.data.results;
        
        // Parse token structure or decode JWT payload to find real expiration
        let expiresAt = Date.now() + 24 * 60 * 60 * 1000; // Default fallback to 24 hours
        try {
          const parts = results.token.split('.');
          if (parts.length === 3) {
            const payloadDecoded = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
            if (payloadDecoded.exp) {
              expiresAt = payloadDecoded.exp * 1000; // exp is in seconds, convert to ms
              this.logger.log(`JWT successfully parsed. Expiration set to: ${new Date(expiresAt).toISOString()}`);
            }
          }
        } catch (e) {
          this.logger.warn(`Failed to parse JWT exp payload, using 24h default TTL. Error: ${e.message}`);
        }

        this.logger.log(`Successfully authenticated user ${results.nombreUsuario} for agency ${results.nombreAgencia}.`);

        return {
          token: results.token,
          expiresAt,
          usuarioID: parseInt(results.usuarioID),
          nombreUsuario: results.nombreUsuario,
          nombreAgencia: results.nombreAgencia,
        };
      }

      throw new UnauthorizedException(response.data?.message || 'Invalid credentials or failed login response');
    } catch (error) {
      if (error.response) {
        this.logger.error(`Authentication request failed (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        this.logger.error(`Error connecting to Authentication API: ${error.message}`);
      }
      throw new UnauthorizedException('Authentication with Global DMS failed.');
    }
  }
}
