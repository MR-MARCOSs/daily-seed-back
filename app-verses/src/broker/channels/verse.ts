import { broker } from "../broker.ts";

export const verses = await broker.createChannel()

verses.assertQueue('verses')