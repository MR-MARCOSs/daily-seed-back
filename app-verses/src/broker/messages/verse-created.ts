import { channels } from "../channels/index.ts";
import type { VerseCreatedMessage } from '../../../../contracts/messages/verse-created-message.ts'

export function sendVerseCreated( data: VerseCreatedMessage ) {
        channels.verses.sendToQueue('verses', Buffer.from(JSON.stringify(data)))
}