import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtService, type JWTPayload } from './jwt.ts';

export interface AuthenticatedRequest extends FastifyRequest {
  user?: JWTPayload;
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Kong JWT plugin adiciona informações no header
  const kongConsumerId = request.headers['x-consumer-id'];
  const kongConsumerUsername = request.headers['x-consumer-username'];
  
  // Se Kong já validou, podemos confiar nos headers
  if (kongConsumerId && kongConsumerUsername) {
    (request as any).user = {
      userId: kongConsumerId as string,
      name: kongConsumerUsername as string,
      role: request.headers['x-consumer-custom-id'] as string || 'user',
    };
    return;
  }

  // Fallback para validação direta (sem Kong)
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

  (request as any).user = payload;
}