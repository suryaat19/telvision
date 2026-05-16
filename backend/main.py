from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import json
import os
import io
from PIL import Image
import pytesseract
from indic_transliteration import sanscript
from indic_transliteration.sanscript import transliterate
from spellchecker import process_spellcheck
from transformers import PreTrainedTokenizerFast

app = FastAPI()

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "Telvision Backend is running perfectly!"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("Loading Hugging Face Telugu Tokenizer...")
try:
    hf_tokenizer = PreTrainedTokenizerFast(
        tokenizer_file="telugu_wordpiece.json",
        unk_token="[UNK]",
        pad_token="[PAD]",
        cls_token="[CLS]",
        sep_token="[SEP]",
        mask_token="[MASK]"
    )
except Exception as e:
    print(f"Warning: Could not load tokenizer. Make sure 'telugu_wordpiece.json' is in the folder. Error: {e}")

class TransliterationRequest(BaseModel):
    """Request model for transliteration."""
    text: str

class TokenizeRequest(BaseModel):
    """Request model for tokenization."""
    text: str

class OCRResponse(BaseModel):
    """Response model for OCR processing and statistics."""
    text: str
    cleaned_text: str
    char_count: int
    word_count: int
    avg_word_length: float
    sentence_count: int

def load_bpe_vocab(filepath: str = "teluguBPE.json") -> dict:
    """Loads the pre-trained BPE vocabulary from a JSON file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Vocabulary file {filepath} not found.")
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)

def get_text_area(text: str) -> str:
    """Cleans and standardizes text spacing and line breaks."""
    if not text:
        return ""
    text = re.sub(r'[\r\n]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()

def get_character_count(text: str) -> int:
    """Calculates total character count."""
    return len(text)

def get_word_count(text: str) -> int:
    """Calculates total word count."""
    if not text:
        return 0
    words = re.findall(r'[^\W\d_]+|\d+', text)
    return len(words)

def get_average_word_length(text: str) -> float:
    """Calculates average word length in the provided text."""
    if not text:
        return 0.0
    words = re.findall(r'[^\W\d_]+|\d+', text)
    if not words:
        return 0.0
    total_length = sum(len(word) for word in words)
    return total_length / len(words)

import re

import re

class TeluguFSTSBD:
    def __init__(self):
        self.single_letter = r'(?:[a-zA-Z]|[\u0C05-\u0C39][\u0C3E-\u0C4D]?)'
        
        self.abbreviations = [
            "డా", "ప్రొ", "శ్రీ", "మి", "కుమారి", 
            "కి", "మీ", "సెం", "గ్రా", "కిలో", 
            "ఉ", "సా", "రూ"
        ]
        self._compile_fst_rules()

    def _compile_fst_rules(self):
        self.rule_decimals = re.compile(r'(\d)\.(\d)')
        
        abbr_pattern = r'(^|\s)(' + '|'.join(self.abbreviations) + r')\.'
        self.rule_abbr = re.compile(abbr_pattern)        
        
        self.rule_initials = re.compile(r'(^|\s|<DOT>)(' + self.single_letter + r')\.')
        
        self.rule_quotes = re.compile(r'\.([\'\"])')
        self.rule_boundaries = re.compile(r'([.?!|])(?:\s+|$)')

    def apply_fst_cascade(self, text):
        """Applies the FST state transitions via regex cascading."""
        if not text:
            return ""
        
        text = self.rule_decimals.sub(r'\1<DOT>\2', text)
        text = self.rule_abbr.sub(r'\1\2<DOT>', text)
        
        prev_text = ""
        while text != prev_text:
            prev_text = text
            text = self.rule_initials.sub(r'\1\2<DOT>', text)
            
        text = self.rule_quotes.sub(r'<DOT>\1', text)
        text = self.rule_boundaries.sub(r'\1\n', text)
        text = text.replace('<DOT>', '.')
        return text

    def segment_corpus(self, corpus_text):
        """Processes the corpus and returns a list of sentences and the total count."""
        if not corpus_text or not corpus_text.strip():
            return [], 0
        processed_text = self.apply_fst_cascade(corpus_text)
        sentences = [s.strip() for s in processed_text.split('\n') if s.strip()]
        return sentences, len(sentences)

telugu_sbd = TeluguFSTSBD()

def get_sentence_count(text: str) -> int:
    """Calculates sentence count strictly based on Telugu language FST rules."""
    _, count = telugu_sbd.segment_corpus(text)
    return count

async def run_tesseract_ocr(image_bytes: bytes) -> str:
    """Executes Tesseract OCR extraction specifically for Telugu."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        extracted_text = pytesseract.image_to_string(image, lang='tel')
        return extracted_text
    except Exception as e:
        raise Exception(f"Tesseract engine failed to process image: {str(e)}")

@app.post("/api/transliterate")
async def convert_text(request: TransliterationRequest):
    """Converts Romanized Telugu or code-mixed text to Telugu script."""
    transliterated = transliterate(request.text, sanscript.ITRANS, sanscript.TELUGU)
    return {
        "original_text": request.text, 
        "transliterated_text": transliterated
    }

@app.post("/api/tokenize")
async def tokenize_text(data: TokenizeRequest):
    """Tokenizes input text utilizing the custom trained Telugu WordPiece tokenizer."""
    try:
        tokens = hf_tokenizer.tokenize(data.text)
        token_ids = hf_tokenizer.encode(data.text)
        
        return {
            "text": data.text,
            "tokens": tokens,
            "token_ids": token_ids
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ocr", response_model=OCRResponse)
async def process_ocr(file: UploadFile = File(...)):
    """Processes an uploaded image for Telugu OCR and returns text statistics."""
    try:
        image_bytes = await file.read()
        extracted_text = await run_tesseract_ocr(image_bytes)
        cleaned_text = get_text_area(extracted_text)
        return OCRResponse(
            text=extracted_text,
            cleaned_text=cleaned_text,
            char_count=get_character_count(extracted_text),
            word_count=get_word_count(extracted_text),
            avg_word_length=get_average_word_length(extracted_text),
            sentence_count=get_sentence_count(extracted_text)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR Processing failed: {str(e)}")
    
class SpellCheckRequest(BaseModel):
    """Request model for spellchecking."""
    text: str

@app.post("/api/spellcheck")
async def spellcheck_text(request: SpellCheckRequest):
    """Executes Bi-Directional Trie morphological spellchecking."""
    try:
        results = process_spellcheck(request.text)
        return {"results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))