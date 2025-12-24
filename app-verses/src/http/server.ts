import '@opentelemetry/auto-instrumentations-node/register'
import { trace } from '@opentelemetry/api'
import fastifyCors from "@fastify/cors";
import fastify from "fastify";
import z from "zod";
import { serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider
 } from "fastify-type-provider-zod";
import { channels } from "../broker/channels/index.ts";
import { db } from "../db/client.ts";
import { schema } from "../db/schema/index.ts";
import { sendVerseCreated } from "../broker/messages/verse-created.ts";
import { sql } from 'drizzle-orm';


const app = fastify().withTypeProvider<ZodTypeProvider>()
app.setSerializerCompiler(serializerCompiler)
app.setValidatorCompiler(validatorCompiler)

app.register(fastifyCors, {
    origin: '*',
})

app.get('/health', () => {
    return 'OK' 
})

app.post('/verse', {
    schema: {
        body: z.object({
            book: z.string(),
            chapter: z.number(),
            text: z.string(),
            lesson: z.string(),
            from: z.number(),
            to: z.number().optional(),
        })
        
    }
}, async (request, reply) => {
    const { book, chapter, from, to, text, lesson } = request.body

    sendVerseCreated({
        book,
        chapter,
        lesson,
        from,
        to,
        text,
        approved: false,
    })

    await db.insert(schema.verses).values({
        book,
        chapter,
        lesson,
        from,
        to,
        text
    })

    

    trace.getActiveSpan()?.setAttribute('book', book)

    return reply.status(201).send()
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

app.listen({ host: '0.0.0.0', port: 3333 }).then(()=> { console.log("HTTP Server Running") })
