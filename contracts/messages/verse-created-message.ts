export interface VerseCreatedMessage {
    book: string,
    chapter: number,
    lesson: string,
    from: number,
    to: number,
    text: string,
    approved: boolean
    
}