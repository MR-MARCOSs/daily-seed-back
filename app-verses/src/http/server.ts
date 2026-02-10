import '@opentelemetry/auto-instrumentations-node/register';
import { trace } from '@opentelemetry/api';
import fastifyCookie from '@fastify/cookie';
import fastify from 'fastify';
import z from 'zod';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { channels } from '../broker/channels/index.ts';
import { db } from '../db/client.ts';
import { schema } from '../db/schema/index.ts';
import { sendVerseCreated } from '../broker/messages/verse-created.ts';
import { sql, eq } from 'drizzle-orm';
import { authenticate,  type AuthenticatedRequest} from '../auth/middleware.ts';
import { authService } from '../auth/auth-service.ts';
import { jwtService, type JWTPayload } from '../auth/jwt.ts';
import { externalBibleService } from '../services/external-bible.ts';

const app = fastify().withTypeProvider<ZodTypeProvider>();
app.setSerializerCompiler(serializerCompiler);
app.setValidatorCompiler(validatorCompiler);

app.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET,
  hook: 'onRequest',
});

declare module 'fastify' {
  interface FastifyRequest {
    user?: JWTPayload;
  }
}

// app.post('/auth/register', {
//   schema: {
//     body: z.object({
//       name: z.string(),
//       password: z.string().min(6),
//       role: z.string().optional(),
//     }),
//   },
// }, async (request, reply) => {
//   try {
//     const { name, password, role } = request.body;
//     const result = await authService.register(name, password, role);
//     return reply.status(201).send(result);
//   } catch (error: any) {
//     return reply.status(400).send({
//       error: error.message,
//       code: 'REGISTRATION_ERROR',
//     });
//   }
// });
// teste222

app.post('/auth/login', {
  schema: {
    body: z.object({
      name: z.string(),
      password: z.string().min(1),
    }),
  },
}, async (request, reply) => {
  try {
    const { name, password } = request.body;
    const result = await authService.login(name, password);
    
    reply.setCookie('refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', 
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60, 
    });
    
    return reply.send({
      user: result.user,
      accessToken: result.tokens.accessToken,
    });
  } catch (error: any) {
    return reply.status(401).send({
      error: error.message,
      code: 'INVALID_CREDENTIALS',
    });
  }
});

app.post('/auth/refresh', async (request, reply) => {
  try {
    
    const refreshToken = request.cookies.refresh_token;
    
    if (!refreshToken) {
      return reply.status(401).send({
        error: 'Refresh token não encontrado',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }
    
    const tokens = await authService.refreshTokens(refreshToken);
    
    reply.setCookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60,
    });
    
    return reply.send({
      accessToken: tokens.accessToken,
    });
  } catch (error: any) {
    
    reply.clearCookie('refresh_token', {
      path: '/auth/refresh',
    });
    
    return reply.status(401).send({
      error: error.message,
      code: 'INVALID_REFRESH_TOKEN',
    });
  }
});

app.post('/auth/logout', {
  preHandler: [authenticate],
}, async (request: AuthenticatedRequest, reply) => {
  try {
    if (request.user) {
      await authService.logout(request.user.userId);
    }
    
    reply.clearCookie('refresh_token', {
      path: '/auth/refresh',
    });
    
    return reply.send({ message: 'Logout realizado com sucesso' });
  } catch (error: any) {
    return reply.status(500).send({
      error: error.message,
      code: 'LOGOUT_ERROR',
    });
  }
});

app.get('/health', () => {
  return 'OK';
});

app.post('/verse', {
  schema: {
    body: z.object({
      book: z.string(),
      chapter: z.number(),
      text: z.string(),
      lesson: z.string(),
      from: z.number(),
      to: z.number().optional(),
    }),
  },
}, async (request, reply) => {
  const { book, chapter, from, to, text, lesson } = request.body;

  sendVerseCreated({
    book,
    chapter,
    lesson,
    from,
    to,
    text,
    approved: false,
  });

  await db.insert(schema.verses).values({
    book,
    chapter,
    lesson,
    from,
    to,
    text,
  });

  trace.getActiveSpan()?.setAttribute('book', book);

  return reply.status(201).send();
});

app.get('/verse', async (request, reply) => {
  try {
    const maxResult = await db
      .select({ maxId: sql<number>`MAX(id)` })
      .from(schema.verses)
      .where(sql`approved = true`);

    const maxId = maxResult[0]?.maxId || 0;

    if (maxId === 0) {
      return reply.status(404).send({ error: 'Nenhum versículo aprovado encontrado' });
    }

    const randomId = Math.floor(Math.random() * maxId) + 1;

    const verses = await db
      .select()
      .from(schema.verses)
      .where(sql`approved = true AND id >= ${randomId}`)
      .orderBy(schema.verses.id)
      .limit(1);

    const verse = verses[0];

    if (!verse) {
      const fallbackVerse = await db
        .select()
        .from(schema.verses)
        .where(sql`approved = true`)
        .orderBy(schema.verses.id)
        .limit(1);

      return reply.status(200).send({ verse: fallbackVerse[0] });
    }

    return reply.status(200).send({ verse });
  } catch (error) {
    return reply.status(500).send({ error: 'Erro ao buscar versículo aleatório' });
  }
});

app.get('/admin/verses/pending', {
  preHandler: [authenticate],
}, async (request: AuthenticatedRequest, reply) => {
  try {
    const { page = 1, limit = 20 } = request.query as any;
    const offset = (page - 1) * limit;

    const pendingVerses = await db
      .select()
      .from(schema.verses)
      .where(sql`approved = false`)
      .orderBy(schema.verses.createdAt)
      .limit(limit)
      .offset(offset);

    const totalResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.verses)
      .where(sql`approved = false`);

    const total = totalResult[0]?.count || 0;

    return reply.send({
      verses: pendingVerses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Erro ao buscar versículos pendentes:', error);
    return reply.status(500).send({
      error: 'Erro ao buscar versículos pendentes',
      code: 'SERVER_ERROR',
    });
  }
});

app.patch('/admin/verses/:id/approve', {
  preHandler: [authenticate],
  schema: {
    params: z.object({
      id: z.string(),
    }),
    body: z.object({
      approved: z.boolean(),
      lesson: z.string().optional(),
    }),
  },
}, async (request: AuthenticatedRequest, reply) => {
  try {
    const { id } = request.params as any;
    const { approved, lesson } = request.body as any;
    
    const [verse] = await db
      .select()
      .from(schema.verses)
      .where(eq(schema.verses.id, id))
      .limit(1);

    if (!verse) {
      return reply.status(404).send({
        error: 'Versículo não encontrado',
        code: 'VERSE_NOT_FOUND',
      });
    }

    if (approved) {
      const updateData: any = { approved: true };
      if (lesson) {
        updateData.lesson = lesson;
      }
      
      await db
        .update(schema.verses)
        .set(updateData)
        .where(eq(schema.verses.id, id));
        
      return reply.send({
        message: 'Versículo aprovado com sucesso',
      });
    } else {
      await db
        .delete(schema.verses)
        .where(eq(schema.verses.id, id));
        
      return reply.send({
        message: 'Versículo rejeitado e removido do banco de dados',
      });
    }
  } catch (error) {
    console.error('Erro ao processar versículo:', error);
    return reply.status(500).send({
      error: 'Erro ao processar versículo',
      code: 'SERVER_ERROR',
    });
  }
});

app.get('/profile', {
  preHandler: [authenticate],
}, async (request: AuthenticatedRequest, reply) => {
  try {
    const user = request.user;
    return reply.send({
      user: {
        userId: user?.userId,
        name: user?.name,
        role: user?.role,
      },
    });
  } catch (error) {
    return reply.status(500).send({
      error: 'Erro ao buscar perfil',
      code: 'SERVER_ERROR',
    });
  }
});

app.get('/bible/range/:book/:chapter', {
  schema: {
    params: z.object({
      book: z.string(),
      chapter: z.coerce.number().min(1),
    }),
    querystring: z.object({
      from: z.coerce.number().min(1),
      to: z.coerce.number().min(1).optional(),
    }).refine((data) => {

      if (!data.to) return true;
      return data.to >= data.from;
    }, {
      message: "O versículo final (to) deve ser maior ou igual ao inicial (from)",
      path: ["to"],
    }),
  },
}, async (request, reply) => {
  const { book, chapter } = request.params;
  const { from, to } = request.query;

  try {
    const result = await externalBibleService.getVersesRange(book, chapter, from, to);

    if (!result) {
      return reply.status(404).send({ error: 'Versículos não encontrados.' });
    }

    return reply.send(result);

  } catch (error) {
    return reply.status(502).send({ error: 'Erro externo.' });
  }
});

app.listen({ host: '0.0.0.0', port: 3333 }).then(() => {
  console.log('HTTP Server Running');
});