export interface AuthResult {
  usuario: string;
  usuarioID: number;
  token: string;
  nombreUsuario: string;
  nombreAgencia: string;
}

export interface AuthSession {
  token: string;
  expiresAt: number; // Timestamp in milliseconds
  usuarioID: number;
  nombreUsuario: string;
  nombreAgencia: string;
}
