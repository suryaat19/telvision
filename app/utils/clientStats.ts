export function getTextArea(text: string): string {
  if (!text) return "";

  return text
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getSentenceCount(text: string): number {
  if (!text) return 0;
  const matches = text.match(/[^\.!\?]+[\.!\?]+/g);
  return matches ? matches.length : 0;
}

export function getWordCount(text: string): number {
  if (!text) return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

export function getCharacterCount(text: string): number {
  return text.length;
}

export function getAverageWordLength(text: string): number {
  const words = text.match(/[\p{L}\p{M}]+/gu);
  if (!words || words.length === 0) return 0;
  
  const totalLength = words.reduce((sum, word) => sum + word.length, 0);
  return totalLength / words.length;
}