import { pgTable, text, integer, serial, boolean } from "drizzle-orm/pg-core";

export const verses = pgTable('verses', {
    id: serial("id").primaryKey(),
    text: text().notNull(),
    book: text().notNull(),
    chapter: integer().notNull(),
    lesson: text().notNull(),
    from: integer().notNull(),
    to: integer(),
    approved: boolean().default(false)
})

