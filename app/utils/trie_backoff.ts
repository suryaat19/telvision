export interface MatchResult {
    dictWord: string;       
    matchedPrefixLen: number; 
    cost: number;           
}

export class TrieNode {
    children: Map<string, TrieNode> = new Map();
    isWord: boolean = false;
    word: string = ""; 
}

export class Trie {
    root: TrieNode = new TrieNode();

    insert(word: string): void {
        let node = this.root;
        for (const char of word) {
            if (!node.children.has(char)) {
                node.children.set(char, new TrieNode());
            }
            node = node.children.get(char)!;
        }
        node.isWord = true;
        node.word = word;
    }
}