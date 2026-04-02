import sys
from collections import defaultdict

class ByteLevelBPE:
    def __init__(self, target_vocab_size):
        self.target_vocab_size = target_vocab_size
        self.vocab_size = 256
        self.merges = {}

    def get_stats(self, ids):
        """Counts frequencies of adjacent byte pairs."""
        counts = defaultdict(int)
        for i in range(len(ids) - 1):
            counts[(ids[i], ids[i+1])] += 1
        return counts

    def merge(self, ids, pair, idx):
        """Replaces all occurrences of `pair` in `ids` with `idx`."""
        new_ids = []
        i = 0
        while i < len(ids):
            if i < len(ids) - 1 and ids[i] == pair[0] and ids[i+1] == pair[1]:
                new_ids.append(idx)
                i += 2
            else:
                new_ids.append(ids[i])
                i += 1
        return new_ids

    def train(self, text):
        print(f"Training BBPE for target vocab size: {self.target_vocab_size}...")
        text_bytes = text.encode("utf-8")
        ids = list(text_bytes)

        num_merges = self.target_vocab_size - 256
        
        for i in range(num_merges):
            stats = self.get_stats(ids)
            if not stats:
                break
                
            best_pair = max(stats, key=stats.get)
            new_id = 256 + i
            
            self.merges[best_pair] = new_id
            
            ids = self.merge(ids, best_pair, new_id)
            self.vocab_size += 1

        print(f"Training complete. Final vocab size: {self.vocab_size}")

    def tokenize(self, text):
        text_bytes = text.encode("utf-8")
        ids = list(text_bytes)
        
        for pair, new_id in self.merges.items():
            ids = self.merge(ids, pair, new_id)
            
        return ids

def evaluate_robustness():
    
    corpus = "The quick brown fox jumps over the lazy dog. Artificial intelligence is evolving rapidly."
    
    noisy_texts = {
        "Clean": corpus,
        "Spelling Mistakes": "The qick brwn fox jumps over the lzy dog. Artifcial inteligence is evolving rapidy.",
        "OCR Distortions": "The qvick br0wn fox jurnps over the lazy d0g. Artif1cial intelligence is ev0lving rapidly."
    }

    tokenizer = ByteLevelBPE(target_vocab_size=300)
    tokenizer.train(corpus)

    print("\n--- BBPE Robustness Evaluation ---")
    for condition, text in noisy_texts.items():
        tokens = tokenizer.tokenize(text)
        print(f"\nCondition: {condition}")
        print(f"Text: {text}")
        print(f"Tokenized Output (IDs): {tokens}")
        print(f"Total Tokens: {len(tokens)}")

if __name__ == "__main__":
    evaluate_robustness()