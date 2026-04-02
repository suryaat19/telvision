from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
from collections import Counter, defaultdict
import time
import sys

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

trained_bpe_models = {}
VOCAB_SIZES = [8000, 16000, 32000, 64000, 128000, 256000]


class UploadCorpusRequest(BaseModel):
    text: str


class TokenizeRequest(BaseModel):
    text: str
    vocab_size: int

def process_bash_style(text: str) -> Counter:
    cleaned_text = re.sub(r'[^a-z\s]', '', text.lower())
    words = cleaned_text.split()
    return Counter(words)

def get_stats(vocab):
    pairs = defaultdict(int)
    for word, freq in vocab.items():
        symbols = word.split()
        for i in range(len(symbols) - 1):
            pairs[(symbols[i], symbols[i + 1])] += freq
    return pairs


def merge_vocab(pair, v_in):
    v_out = {}
    bigram = re.escape(' '.join(pair))
    pattern = re.compile(r'(?<!\S)' + bigram + r'(?!\S)')

    for word, freq in v_in.items():
        w_out = pattern.sub(''.join(pair), word)
        v_out[w_out] = v_out.get(w_out, 0) + freq  # FIXED

    return v_out


def apply_bpe_to_word(word, merges):
    word_chars = " ".join(list(word))

    for pair in merges:
        bigram = re.escape(' '.join(pair))
        pattern = re.compile(r'(?<!\S)' + bigram + r'(?!\S)')
        word_chars = pattern.sub(''.join(pair), word_chars)

    return word_chars.split()

def compute_vocab_from_merges(merges):
    vocab = set()
    for a, b in merges:
        vocab.add(a)
        vocab.add(b)
        vocab.add(a + b)
    return vocab


def evaluate_bpe(word_counts, merges, vocab):
    total_words = sum(word_counts.values())

    total_tokens = sum(len(w.split()) * freq for w, freq in vocab.items())
    avg_tokens_per_word = total_tokens / total_words

    original_chars = sum(len(w) * freq for w, freq in word_counts.items())
    compression_ratio = max(0, (1 - (total_tokens / original_chars)) * 100)

    token_vocab = compute_vocab_from_merges(merges)

    start = time.time()
    tokenized = []
    for word in word_counts.keys():
        sub = apply_bpe_to_word(word + "</w>", merges)
        tokenized.extend(sub)
    tok_time = round(time.time() - start, 4)

    oov_tokens = [t for t in tokenized if t not in token_vocab]
    oov_rate = (len(oov_tokens) / len(tokenized)) * 100 if tokenized else 0

    memory_kb = (sys.getsizeof(merges) + sys.getsizeof(token_vocab)) / 1024

    return {
        "avgTokensPerWord": round(avg_tokens_per_word, 3),
        "compression(%)": round(compression_ratio, 2),
        "oovRate(%)": round(oov_rate, 2),
        "tokenizationTime(s)": tok_time,
        "memory(KB)": round(memory_kb, 2),
        "uniqueSubwords": len(token_vocab)
    }


def get_top_merges(pairs, top_n=10):
    sorted_pairs = sorted(pairs.items(), key=lambda x: x[1], reverse=True)
    return [
        {"pair": f"{a}+{b}", "count": freq}
        for (a, b), freq in sorted_pairs[:top_n]
    ]

@app.post("/api/train")
async def train_bpe_models(data: UploadCorpusRequest):
    start_time = time.time()

    word_counts = process_bash_style(data.text)
    total_words = sum(word_counts.values())

    if total_words == 0:
        raise HTTPException(status_code=400, detail="Corpus is empty after cleaning.")

    initial_vocab_size = len(word_counts)

    vocab = {' '.join(list(word)) + ' </w>': freq for word, freq in word_counts.items()}

    base_chars = set()
    for word in vocab.keys():
        base_chars.update(word.split())

    current_vocab_size = len(base_chars)
    merges_learned = []
    stats_output = []

    global trained_bpe_models
    trained_bpe_models.clear()

    target_sizes = sorted(VOCAB_SIZES)
    max_target = target_sizes[-1]

    graph_data = {
        "vocab_vs_compression": [],
        "vocab_vs_tokens": []
    }

    while current_vocab_size < max_target:
        pairs = get_stats(vocab)
        if not pairs:
            break

        best_pair = max(pairs, key=pairs.get)
        best_freq = pairs[best_pair]
        if best_freq < 2:
            print("Stopping early: no more frequent pairs")
            break

        print(f"[MERGE {len(merges_learned)+1}] {best_pair} -> {''.join(best_pair)} | freq={best_freq} | vocab_size={current_vocab_size}")

        vocab = merge_vocab(best_pair, vocab)
        merges_learned.append(best_pair)
        current_vocab_size += 1

        if current_vocab_size in target_sizes:
            metrics = evaluate_bpe(word_counts, merges_learned, vocab)

            trained_bpe_models[current_vocab_size] = list(merges_learned)

            graph_data["vocab_vs_compression"].append({
                "vocabSize": current_vocab_size,
                "compression": metrics["compression(%)"]
            })

            graph_data["vocab_vs_tokens"].append({
                "vocabSize": current_vocab_size,
                "avgTokensPerWord": metrics["avgTokensPerWord"]
            })

            pairs = get_stats(vocab)
            top_merges = get_top_merges(pairs)

            stats_output.append({
                "vocabSize": current_vocab_size,
                **metrics,
                "topMerges": top_merges
            })

    final_metrics = evaluate_bpe(word_counts, merges_learned, vocab)
    pairs = get_stats(vocab)
    top_merges = get_top_merges(pairs)

    for size in target_sizes:
        if size not in trained_bpe_models:
            trained_bpe_models[size] = list(merges_learned)

            stats_output.append({
                "vocabSize": size,
                **final_metrics,
                "topMerges": top_merges,
                "note": "Maxed out (corpus too small)"
            })
            
            graph_data["vocab_vs_compression"].append({
                "vocabSize": size,
                "compression": final_metrics["compression(%)"]
            })

            graph_data["vocab_vs_tokens"].append({
                "vocabSize": size,
                "avgTokensPerWord": final_metrics["avgTokensPerWord"]
            })

    elapsed_time = round(time.time() - start_time, 2)

    return {
        "message": "BPE Models trained successfully",
        "time_taken_seconds": elapsed_time,
        "initial_vocab_size": initial_vocab_size,
        "stats": stats_output,
        "graphs": graph_data
    }

@app.post("/api/tokenize")
async def tokenize_text(data: TokenizeRequest):
    if data.vocab_size not in trained_bpe_models:
        raise HTTPException(
            status_code=400,
            detail=f"Model for vocab size {data.vocab_size} not trained yet."
        )

    merges_to_apply = trained_bpe_models[data.vocab_size]

    words = re.split(r'(\s+)', data.text)
    tokens = []

    for word in words:
        if word.isspace() or len(word.strip()) == 0:
            tokens.append(word)
            continue

        cleaned_word = re.sub(r'[^a-zA-Z]', '', word).lower()
        if not cleaned_word:
            tokens.append(word)
            continue

        word_with_end = cleaned_word + "</w>"
        subwords = apply_bpe_to_word(word_with_end, merges_to_apply)

        subwords = [sw.replace("</w>", "") for sw in subwords]
        tokens.extend(subwords)

    return {
        "vocab_size": data.vocab_size,
        "tokens": [t for t in tokens if t]
    }