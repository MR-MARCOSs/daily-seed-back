import '@opentelemetry/auto-instrumentations-node/register'

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
            to: z.number(),
            
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

    return reply.status(201).send()
});

app.listen({ host: '0.0.0.0', port: 3333 }).then(()=> { console.log("HTTP Server Running") })
