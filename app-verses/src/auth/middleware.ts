import { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService, JWTPayload } from './jwt.ts';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JWTPayload;
}

export async function authenticate(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    return reply.status(401).send({
      error: 'Token de autenticação não fornecido',
      code: 'MISSING_TOKEN'
    });
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return reply.status(401).send({
      error: 'Formato de token inválido. Use: Bearer <token>',
      code: 'INVALID_TOKEN_FORMAT'
    });
  }

  const payload = jwtService.verifyAccessToken(token);

  if (!payload) {
    return reply.status(401).send({
      error: 'Token inválido ou expirado',
      code: 'INVALID_TOKEN'
    });
  }

  request.user = payload;
}

export function requireRole(allowedRoles: string[]) {
  return async (request: AuthenticatedRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Não autenticado',
        code: 'UNAUTHENTICATED'
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }
  };
}