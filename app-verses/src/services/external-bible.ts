interface ExternalVerse {
  number: number;
  text: string;
}

interface ExternalChapterResponse {
  book: {
    name: string;
    author: string;
    group: string;
    version: string;
  };
  chapter: {
    number: number;
    verses: number;
  };
  verses: ExternalVerse[];
}

interface FormattedRange {
  reference: string; 
  book: string;
  chapter: number;
  text: string; 
  verses: ExternalVerse[]; 
}

const BASE_URL = process.env.ABIBLIA_DIGITAL_URL;
const TOKEN = process.env.ABIBLIA_DIGITAL_TOKEN;

if (!BASE_URL || !TOKEN) {
  throw new Error('Variáveis de ambiente ABIBLIA_DIGITAL não configuradas.');
}

export const externalBibleService = {
  getVersesRange: async (
    bookAbbrev: string, 
    chapter: number, 
    from: number, 
    to?: number 
  ): Promise<FormattedRange | null> => {
    try {
      const version = 'nvi';
      const response = await fetch(`${BASE_URL}/verses/${version}/${bookAbbrev}/${chapter}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Erro API Externa: ${response.statusText}`);

      const data = (await response.json()) as ExternalChapterResponse;

      if (!data.verses || data.verses.length === 0) return null;
      const endVerse = to || from; 
      const filteredVerses = data.verses.filter(
        (v) => v.number >= from && v.number <= endVerse
      );
      if (filteredVerses.length === 0) return null;
      const fullText = filteredVerses.map(v => v.text).join(' ');

      return {
        reference: `${data.book.name} ${chapter}:${from}${to ? `-${to}` : ''}`,
        book: data.book.name,
        chapter: data.chapter.number,
        text: fullText,
        verses: filteredVerses
      };

    } catch (error) {
      console.error('Falha no serviço de bíblia:', error);
      throw error;
    }
  }
};