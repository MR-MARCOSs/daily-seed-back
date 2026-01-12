import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

config();

export interface JWTPayload {
  userId: string;
  name: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class JWTService {
  private readonly ACCESS_SECRET: string;
  private readonly REFRESH_SECRET: string;
  private readonly ACCESS_EXPIRES_IN = '15m'; // Token curto
  private readonly REFRESH_EXPIRES_IN = '7d'; // Token longo para renovação

  constructor() {
    // Em produção, use variáveis de ambiente seguras
    this.ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'your-super-secret-access-key-change-in-production';
    this.REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key-change-in-production';
    
    if (!this.ACCESS_SECRET || !this.REFRESH_SECRET) {
      throw new Error('JWT secrets must be defined in environment variables');
    }
  }

  generateTokens(payload: JWTPayload): TokenPair {
    const accessToken = jwt.sign(
      { ...payload, type: 'access' },
      this.ACCESS_SECRET,
      { expiresIn: this.ACCESS_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      { ...payload, type: 'refresh' },
      this.REFRESH_SECRET,
      { expiresIn: this.REFRESH_EXPIRES_IN }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.ACCESS_SECRET) as JWTPayload & { type: string };
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  verifyRefreshToken(token: string): JWTPayload | null {
    try {
      const decoded = jwt.verify(token, this.REFRESH_SECRET) as JWTPayload & { type: string };
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }
      return decoded;
    } catch (error) {
      return null;
    }
  }

  decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}

export const jwtService = new JWTService();