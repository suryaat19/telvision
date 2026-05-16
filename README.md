# Telvision

Telvision is a high-performance Natural Language Processing (NLP) and Optical Character Recognition (OCR) suite specifically engineered for the Telugu language. It is designed to handle the complex morphology and agglutinative nature of Dravidian languages, offering real-time text extraction, morphological spellchecking, and subword tokenization.

**Live Demo:** [telvision.vercel.app](https://telvision.vercel.app)

---

## Core Modules

### 1. Telvision (OCR & Morphological Analysis)
A dedicated environment for digitizing and analyzing Telugu text.

* **Optical Character Recognition:** Extracts Telugu text from uploaded images using specialized Tesseract models.
* **Smart Spellchecking:** Utilizes a custom Bi-Directional Trie architecture and Finite State Transducers (FST). It intelligently splits words to validate root stems and valid Telugu suffixes, rather than relying solely on static dictionary lookups.
* **Corpus Statistics:** Calculates character counts, word density, and FST-based sentence boundaries.

### 2. Teltokenizer (Subword Tokenization)
A visual playground for advanced Telugu tokenization, vital for downstream machine learning and LLM tasks.

* **Custom WordPiece Model:** Powered by a custom-trained Hugging Face WordPiece tokenizer, trained from scratch on millions of sentences from the AI4Bharat IndicCorpV2 dataset.
* **OOV Handling:** Effectively manages Out-Of-Vocabulary words by intelligently fracturing complex Telugu vocabulary into logical subwords (roots and modifiers).
* **Interactive UI:** A streamlined, glassmorphic visualizer that categorizes and color-codes subword chunks in real-time as the user types.

### 3. Integrated Input Systems
* **Custom Virtual Telugu Keyboard:** A bespoke, responsive on-screen keyboard engineered specifically for Telugu. It features dual input modes: a traditional **InScript layout** (complete with vowels, consonants, modifiers, and vattulu) for precise native typing, and a **Phonetic mode** that instantly transliterates code-mixed Romanized English (e.g., "namaskaram") into Telugu script.

---

## Technical Stack

### Frontend (Client)
* **Framework:** Next.js (App Router)
* **Libraries:** React, Tailwind CSS
* **Design System:** Custom Brutalist & Glassmorphic UI

### Backend (API & NLP)
* **Framework:** FastAPI (Python)
* **ML Inference:** Hugging Face `transformers` (Tokenizer inference)
* **Vision Processing:** `pytesseract` & OpenCV (OCR processing)
* **Algorithms:** Dynamic Programming (Optimized Levenshtein, Jaro, and LCS distance algorithms for spell correction)

---

## Getting Started

### Prerequisites
* Node.js 18+
* Python 3.10+
* Tesseract-OCR (with the Telugu language pack `tel` installed)

### 1. Start the Backend (FastAPI)
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
(Ensure your custom telugu_wordpiece.json and te.wl dictionary files are in the backend directory).

### 2. Start the Frontend (Next.js)
```bash
# In the root directory
npm install
npm run dev
```
Navigate to http://localhost:3000 to access the application.

---

## License
This project is licensed under the MIT License.