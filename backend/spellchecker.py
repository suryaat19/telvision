import os
import re

def get_hamming_distance(a: str, b: str) -> int:
    """Calculates the Hamming distance between two strings by counting the number of positions at which the corresponding characters are different."""
    distance = abs(len(a) - len(b))
    for i in range(min(len(a), len(b))):
        if a[i] != b[i]:
            distance += 1
    return distance

def get_lcs_length(a: str, b: str) -> int:
    """Calculates the length of the Longest Common Subsequence (LCS) between two strings."""
    if len(a) < len(b):
        a, b = b, a
    prev_row = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        curr_row = [0] * (len(b) + 1)
        for j in range(1, len(b) + 1):
            if a[i - 1] == b[j - 1]:
                curr_row[j] = prev_row[j - 1] + 1
            else:
                curr_row[j] = max(prev_row[j], curr_row[j - 1])
        prev_row = curr_row
    return prev_row[len(b)]

def get_levenshtein_distance(s1: str, s2: str) -> int:
    """Calculates the Levenshtein distance, which is the minimum number of single-character edits (insertions, deletions, or substitutions) required to change one string into the other."""
    if len(s1) < len(s2):
        return get_levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    return previous_row[-1]

def get_jaro_distance(s1: str, s2: str) -> float:
    """Calculates the Jaro similarity measure between two strings, returning a value between 0.0 (no similarity) and 1.0 (exact match) based on matching characters and required transpositions."""
    if s1 == s2: return 1.0
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0: return 0.0
    match_distance = max(len1, len2) // 2 - 1
    s1_matches = [False] * len1
    s2_matches = [False] * len2
    matches = 0
    transpositions = 0
    for i in range(len1):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len2)
        for j in range(start, end):
            if s2_matches[j]: continue
            if s1[i] != s2[j]: continue
            s1_matches[i] = True
            s2_matches[j] = True
            matches += 1
            break
    if matches == 0: return 0.0
    k = 0
    for i in range(len1):
        if not s1_matches[i]: continue
        while not s2_matches[k]: k += 1
        if s1[i] != s2[k]: transpositions += 1
        k += 1
    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0

class BiTrie:
    """A data structure used to store a vocabulary and perform morphological splitting to identify stems and valid suffixes."""
    def __init__(self):
        self.vocab_set = set()

    def insert(self, word: str):
        """Inserts a word into the vocabulary set."""
        if word:
            self.vocab_set.add(word)

    def morphological_split(self, word: str):
        """Iterates through a given word to find the longest valid stem and checks if the remaining string is a valid suffix."""
        valid_suffixes = {
            "లు", "ల", "కి", "కు", "ని", "ను", "లో", "తో", "చేత", "వల్ల",
            "అట", "ట", "వి", "ది", "డు", "ము", "వు", "గా", "గ", "క", 
            "అయినా", "అనే", "లోపల", "మరియు", "అని", "ఆ", "ఏ", "ఓ", "డము", "టం"
        }
        best_split = None
        longest_stem = 0
        for i in range(1, len(word)):
            stem, suffix = word[:i], word[i:]
            if stem in self.vocab_set:
                if suffix in self.vocab_set or suffix in valid_suffixes:
                    return {"status": "Correct", "stem": stem, "suffix": suffix, "error_part": None}
                if i > longest_stem:
                    longest_stem = i
                    best_split = {"status": "Wrong", "stem": stem, "suffix": suffix, "error_part": "suffix"}
        if best_split:
            return best_split
        return {"status": "Wrong", "stem": "", "suffix": word, "error_part": "whole"}

bitrie = BiTrie()

def load_dictionary(filepath="te.wl"):
    """Reads a text file containing words and populates the global BiTrie vocabulary set."""
    if not os.path.exists(filepath):
        print(f"CRITICAL ERROR: Could not find dictionary at {os.path.abspath(filepath)}")
        return
    print(f"Loading dictionary from {os.path.abspath(filepath)}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        for line in f:
            word = line.strip()
            if word:
                bitrie.insert(word)
    print(f"Loaded {len(bitrie.vocab_set)} words into the Dictionary!")

load_dictionary()

def process_spellcheck(text: str) -> list:
    """Extracts words from the input text, verifies their correctness using the vocabulary and morphological rules, and calculates distance metrics for incorrect words against the vocabulary."""
    if not text.strip():
        return []
    words = re.findall(r'[\u0C00-\u0C7F]+', text)
    unique_words = list(set(words))
    results = []
    
    for raw_word in unique_words:
        word = raw_word.lower()
        is_correct = False
        segmentation_display = raw_word
        
        if word in bitrie.vocab_set or len(word) <= 1:
            is_correct = True
            segmentation_display = raw_word
        else:
            morph_analysis = bitrie.morphological_split(word)
            if morph_analysis["status"] == "Correct":
                is_correct = True
                segmentation_display = f"{morph_analysis['stem']} + {morph_analysis['suffix']}"
            else:
                if morph_analysis["stem"]:
                    segmentation_display = f"{morph_analysis['stem']} + [ERR: {morph_analysis['suffix']}]"
                else:
                    segmentation_display = raw_word
                    
        candidates = [w for w in bitrie.vocab_set if abs(len(w) - len(word)) <= 2]
        
        best_hamming = {"word": "-", "score": float('inf')}
        best_lcs = {"word": "-", "score": -1}
        best_lev = {"word": "-", "score": float('inf')}
        best_zaro = {"word": "-", "score": -1.0}
        
        for candidate in candidates:
            len_diff = abs(len(word) - len(candidate))
            if len_diff > best_lev["score"] and best_lev["score"] != float('inf'):
                continue

            h_score = get_hamming_distance(word, candidate)
            if h_score < best_hamming["score"]: best_hamming = {"word": candidate, "score": h_score}
            
            l_score = get_lcs_length(word, candidate)
            if l_score > best_lcs["score"]: best_lcs = {"word": candidate, "score": l_score}
            
            lev_score = get_levenshtein_distance(word, candidate)
            if lev_score < best_lev["score"]: best_lev = {"word": candidate, "score": lev_score}
            
            z_score = get_jaro_distance(word, candidate)
            if z_score > best_zaro["score"]: best_zaro = {"word": candidate, "score": z_score}
            
        results.append({
            "word": raw_word,
            "hamming": best_hamming["word"],
            "lcs": best_lcs["word"],
            "levenshtein": best_lev["word"],
            "zaro": best_zaro["word"],
            "benchmark": "Correct" if is_correct else "Wrong",
            "segmentation": segmentation_display
        })
        
    return results