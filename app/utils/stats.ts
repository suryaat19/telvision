import fs from 'fs';
import path from 'path';
import { Trie, TrieNode, MatchResult } from './trie_backoff';

function getHammingDistance(a: string, b: string): number {
  let distance = Math.abs(a.length - b.length);
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] !== b[i]) distance++;
  }
  return distance;
}

function getLongestCommonSubsequenceLength(a: string, b: string): number {
  const m = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        m[i][j] = m[i - 1][j - 1] + 1;
      } else {
        m[i][j] = Math.max(m[i - 1][j], m[i][j - 1]);
      }
    }
  }
  return m[a.length][b.length];
}

function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      
        matrix[i][j - 1] + 1,      
        matrix[i - 1][j - 1] + cost 
      );
    }
  }
  return matrix[a.length][b.length];
}

function getJaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchDistance = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array(len1).fill(false);
  const s2Matches = new Array(len2).fill(false);
  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  return ((matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0);
}

export interface SegmentationResult {
  originalWord: string;
  stem: string;       
  typedStem: string;  
  suffix: string;   
  cost: number;
  message: string;
}

export interface SpellCheckResult {
  word: string;
  hamming: string | number;
  lcs: string | number;
  levenshtein: string | number;
  zaro: string | number;
  benchmark: "Correct" | "Wrong";
  segmentation?: string;
}

export async function spellCheck(
  text: string, 
  langCode: string
): Promise<SpellCheckResult[]> {
  if (!text.trim()) return [];

  const dictFile = langCode === 'tel' ? 'te.wl' : 'en.wl';
  let dictionary: Set<string>;
  let dictionaryArray: string[] = [];
  
  const dictTrie = new Trie();

  try {
    const dictPath = path.join(process.cwd(), 'public', 'dict', dictFile);
    const dictText = fs.readFileSync(dictPath, 'utf-8');
    
    dictionaryArray = dictText.split('\n').map(w => w.trim().toLowerCase()).filter(w => w.length > 0);
    dictionary = new Set(dictionaryArray);
    
    for (const word of dictionaryArray) {
      dictTrie.insert(word);
    }
  } catch (error) {
    console.error("Failed to load dictionary on server:", error);
    return [];
  }

  const wordsMatch = text.match(/[\p{L}\p{M}]+/gu) || [];
  const uniqueWords = Array.from(new Set(wordsMatch)); 
  const totalWords = uniqueWords.length;
  const results: SpellCheckResult[] = [];

  for (let i = 0; i < totalWords; i++) {
    const rawWord = uniqueWords[i];
    const word = rawWord.toLowerCase();
    
    if (dictionary.has(word) || word.length <= 1) {
      results.push({
        word: rawWord,
        hamming: rawWord,
        lcs: rawWord,
        levenshtein: rawWord,
        zaro: rawWord,
        benchmark: "Correct"
      });
      continue;
    }

    const candidates = dictionaryArray.filter(dictWord => Math.abs(dictWord.length - word.length) <= 2);

    let bestHamming = { word: "", score: Infinity };
    let bestLCS = { word: "", score: -1 }; 
    let bestLev = { word: "", score: Infinity };
    let bestZaro = { word: "", score: -1 };

    for (const candidate of candidates) {
      const hamScore = getHammingDistance(word, candidate);
      if (hamScore < bestHamming.score) bestHamming = { word: candidate, score: hamScore };

      const lcsScore = getLongestCommonSubsequenceLength(word, candidate);
      if (lcsScore > bestLCS.score) bestLCS = { word: candidate, score: lcsScore };

      const levScore = getLevenshteinDistance(word, candidate);
      if (levScore < bestLev.score) bestLev = { word: candidate, score: levScore };

      const zaroScore = getJaroDistance(word, candidate);
      if (zaroScore > bestZaro.score) bestZaro = { word: candidate, score: zaroScore };
    }

    const segmentation = segmentWord(word, dictTrie, 1);

    results.push({
      word: rawWord,
      hamming: bestHamming.word || "-",
      lcs: bestLCS.word || "-",
      levenshtein: bestLev.word || "-",
      zaro: bestZaro.word || "-",
      benchmark: "Wrong",
      segmentation: segmentation.cost !== -1 
        ? `${segmentation.typedStem} + ${segmentation.suffix}` 
        : rawWord,
    });
  }

  return results;
}

function searchRecursive(
  node: TrieNode,
  char: string,
  targetWord: string,
  previousRow: number[],
  results: MatchResult[],
  maxCost: number
) {
  const columns = targetWord.length + 1;
  const currentRow = new Array(columns).fill(0);
  
  currentRow[0] = previousRow[0] + 1;
  let minCost = currentRow[0];

  for (let c = 1; c < columns; c++) {
      const insertCost = currentRow[c - 1] + 1;
      const deleteCost = previousRow[c] + 1;
      const replaceCost = targetWord[c - 1] !== char ? previousRow[c - 1] + 1 : previousRow[c - 1];

      currentRow[c] = Math.min(insertCost, deleteCost, replaceCost);
      minCost = Math.min(minCost, currentRow[c]);
  }

  if (node.isWord) {
      for (let c = 1; c < columns; c++) {
          if (currentRow[c] <= maxCost) {
              results.push({
                  dictWord: node.word,
                  matchedPrefixLen: c,
                  cost: currentRow[c]
              });
          }
      }
  }

  if (minCost <= maxCost) {
      for (const [nextChar, childNode] of node.children.entries()) {
          searchRecursive(childNode, nextChar, targetWord, currentRow, results, maxCost);
      }
  }
}

export function segmentWord(inputWord: string, trie: Trie, maxCost: number = 1): SegmentationResult {
  const columns = inputWord.length + 1;
  const currentRow = new Array(columns);
  for (let i = 0; i < columns; i++) {
      currentRow[i] = i;
  }

  const results: MatchResult[] = [];

  for (const [char, childNode] of trie.root.children.entries()) {
      searchRecursive(childNode, char, inputWord, currentRow, results, maxCost);
  }

  if (results.length === 0) {
      return {
          originalWord: inputWord,
          stem: "",
          typedStem: "",
          suffix: inputWord,
          cost: -1,
          message: `No valid root found for '${inputWord}' within edit distance ${maxCost}.`
      };
  }

  results.sort((a, b) => {
      if (a.cost !== b.cost) return a.cost - b.cost;
      return b.matchedPrefixLen - a.matchedPrefixLen;
  });

  const bestMatch = results[0];
  
  const typedStem = inputWord.substring(0, bestMatch.matchedPrefixLen);
  const suffix = inputWord.substring(bestMatch.matchedPrefixLen);

  return {
      originalWord: inputWord,
      stem: bestMatch.dictWord,
      typedStem: typedStem,
      suffix: suffix,
      cost: bestMatch.cost,
      message: `Correction: '${bestMatch.dictWord}' | Typed: '${typedStem}' + '${suffix}'`
  };
}