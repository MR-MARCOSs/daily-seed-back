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
  
  private readonly PRIVATE_KEY: string;
  private readonly PUBLIC_KEY: string;
  
  private readonly ACCESS_EXPIRES_IN = '15m'; 
  private readonly REFRESH_EXPIRES_IN = '7d'; 

  constructor() {
    this.PRIVATE_KEY = (process.env.JWT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    this.PUBLIC_KEY = (process.env.JWT_PUBLIC_KEY || '').replace(/\\n/g, '\n');
    
    if (!this.PRIVATE_KEY || !this.PUBLIC_KEY) {
      throw new Error('JWT keys (Private/Public) must be defined in environment variables');
    }
  }

  generateTokens(payload: JWTPayload): TokenPair {
    const issuer = payload.role === 'admin' ? 'admin-key' : 'mobile-key';    
    const accessToken = jwt.sign(
      { 
        ...payload, 
        type: 'access',
        iss: issuer 
      },
      this.PRIVATE_KEY, 
      { 
        expiresIn: this.ACCESS_EXPIRES_IN,
        algorithm: 'RS256' 
      }
    );

    const refreshToken = jwt.sign(
      { 
        ...payload, 
        type: 'refresh',
        iss: issuer 
      },
      this.PRIVATE_KEY,
      { 
        expiresIn: this.REFRESH_EXPIRES_IN,
        algorithm: 'RS256'
      }
    );

    return { accessToken, refreshToken };
  }

  verifyAccessToken(token: string): JWTPayload | null {
    try {
      
      const decoded = jwt.verify(token, this.PUBLIC_KEY, { algorithms: ['RS256'] }) as JWTPayload & { type: string };
      
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
      const decoded = jwt.verify(token, this.PUBLIC_KEY, { algorithms: ['RS256'] }) as JWTPayload & { type: string };
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