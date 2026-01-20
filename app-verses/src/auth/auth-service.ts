import bcrypt from 'bcryptjs';
import { db } from '../db/client.ts';
import { users } from '../db/schema/users.ts';
import { eq } from 'drizzle-orm';
import { jwtService, type JWTPayload } from './jwt.ts';

export class AuthService {
  async register(name: string, password: string, role?: string) {
    // Verifica se usuário já existe
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.name, name))
      .limit(1);

    if (existingUser.length > 0) {
      throw new Error('Usuário já existe');
    }

    // Hash da senha
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insere usuário
    const [newUser] = await db
      .insert(users)
      .values({
        name,
        password: hashedPassword,
        role: role || 'user',
      })
      .returning();

    // Remove senha do objeto de retorno
    const { password: _, ...userWithoutPassword } = newUser;

    // Gera tokens
    const tokens = jwtService.generateTokens({
      userId: newUser.id,
      name: newUser.name,
      role: newUser.role,
    });

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  async login(name: string, password: string) {
    // Busca usuário
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.name, name))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error('Credenciais inválidas');
    }

    // Verifica senha
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      throw new Error('Credenciais inválidas');
    }

    // Remove senha do objeto de retorno
    const { password: _, ...userWithoutPassword } = user;

    // Gera tokens
    const tokens = jwtService.generateTokens({
      userId: user.id,
      name: user.name,
      role: user.role,
    });

    return {
      user: userWithoutPassword,
      tokens,
    };
  }

  async refreshTokens(refreshToken: string) {
    const payload = jwtService.verifyRefreshToken(refreshToken);

    if (!payload) {
      throw new Error('Refresh token inválido');
    }

    // Verifica se usuário ainda existe e está ativo
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive) {
      throw new Error('Usuário não encontrado ou inativo');
    }

    // Gera novos tokens
    return jwtService.generateTokens({
      userId: user.id,
      name: user.name,
      role: user.role,
    });
  }

  async logout(userId: string) {
    // Em um sistema real, você pode:
    // 1. Adicionar token a uma blacklist
    // 2. Invalidar refresh token
    // 3. Atualizar última atividade
    return { message: 'Logout realizado com sucesso' };
  }
}

export const authService = new AuthService();