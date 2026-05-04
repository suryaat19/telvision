"use client";
import { useState, useRef, useEffect, type ChangeEvent } from "react";
import Link from "next/link";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

const TELUGU_CHARS = {
  vowels: ["అ", "ఆ", "ఇ", "ఈ", "ఉ", "ఊ", "ఋ", "ఎ", "ఏ", "ఐ", "ఒ", "ఓ", "ఔ"],
  consonants: [
    "క", "ఖ", "గ", "ఘ", "ఙ",
    "చ", "ఛ", "జ", "ఝ", "ఞ",
    "ట", "ఠ", "డ", "ఢ", "ణ",
    "త", "థ", "ద", "ధ", "న",
    "ప", "ఫ", "బ", "భ", "మ",
    "య", "ర", "ల", "వ", "శ", "ష", "స", "హ", "ళ", "క్ష", "ఱ",
  ],
  modifiers: ['ా', 'ి', 'ీ', 'ు', 'ూ', 'ృ', 'ె', 'ే', 'ై', 'ొ', 'ో', 'ౌ', 'ం', 'ః', '్'],
  vattulu: [
    '్క', '్ఖ', '్గ', '్ఘ', '్ఙ',
    '్చ', '్ఛ', '్జ', '్ఝ', '్ఞ',
    '్ట', '్ఠ', '్డ', '్ఢ', '్ణ',
    '్త', '్థ', '్ద', '్ధ', '్న',
    '్ప', '్ఫ', '్బ', '్భ', '్మ',
    '్య', '్ర', '్ల', '్వ', '్శ', '్ష', '్స', '్హ', '్ళ', '్క్ష', '్ఱ'
  ]
};

interface SpellCheckResult {
  word: string;
  hamming: string | number;
  lcs: string | number;
  levenshtein: string | number;
  zaro: string | number;
  benchmark: "Correct" | "Wrong";
  segmentation: string;
}

const BACKEND = "https://suryaat19-texvision-api.hf.space";

function countTeluguSentences(text: string): number {
  if (!text || !text.trim()) return 0;

  const singleLetter = `(?:[a-zA-Z]|[\\u0C05-\\u0C39][\\u0C3E-\\u0C4D]?)`;
  const abbreviations = ["డా", "ప్రొ", "శ్రీ", "మి", "కుమారి", "కి", "మీ", "సెం", "గ్రా", "కిలో", "ఉ", "సా", "రూ"];

  let processed = text;
  processed = processed.replace(/(\d)\.(\d)/g, '$1<DOT>$2');

  const sortedAbbrs = [...abbreviations].sort((a, b) => b.length - a.length);
  const abbrPattern = new RegExp(`(^|\\s|<DOT>)(${sortedAbbrs.join('|')})\\.`, 'g');

  let prev = "";
  while (processed !== prev) {
    prev = processed;
    processed = processed.replace(abbrPattern, '$1$2<DOT>');
  }

  const initialsPattern = new RegExp(`(^|\\s|<DOT>)(${singleLetter})\\.`, 'g');
  prev = "";
  while (processed !== prev) {
    prev = processed;
    processed = processed.replace(initialsPattern, '$1$2<DOT>');
  }

  processed = processed.replace(/\.(['"])/g, '<DOT>$1');

  const boundaries = /([.?!|])(?:\s+|$)/g;
  processed = processed.replace(boundaries, '$1\n');

  const sentences = processed.split('\n').map(s => s.trim()).filter(Boolean);
  return sentences.length;
}

function computeStats(text: string) {
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const chars = text.replace(/\s/g, "").length;
  const avg = words.length ? words.reduce((a, w) => a + w.length, 0) / words.length : 0;

  return {
    wordCount: words.length,
    sentenceCount: countTeluguSentences(text),
    charCount: chars,
    avgWordLength: avg,
  };
}

export default function TelVisionApp() {
  const [text, setText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isSpellCheck, setSpellCheck] = useState(false);
  const [spellCheckResults, setSpellCheckResults] = useState<SpellCheckResult[]>([]);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardMode, setKeyboardMode] = useState<"inscript" | "phonetic">("inscript");
  const [englishInput, setEnglishInput] = useState("");
  const [stats, setStats] = useState({ wordCount: 0, sentenceCount: 0, charCount: 0, avgWordLength: 0 });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setStats(computeStats(text));
  }, [text]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setStatus("Sending to OCR backend…");
    setText("");
    setSpellCheck(false);
    setSpellCheckResults([]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${BACKEND}/api/ocr`, { method: "POST", body: formData });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setText(data.cleaned_text || data.text || "");
      setStatus("Done");
    } catch (err) {
      console.error("Backend connection failed:", err);
      setStatus("Backend offline — connect Python OCR at 127.0.0.1:8000");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const downloadTxt = () => {
    const file = new Blob([text], { type: "text/plain" });
    saveAs(file, `extracted_telugu.txt`);
  };

  const downloadPdf = async () => {
    if (!text) return;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    pdf.setFontSize(12);
    const lines = pdf.splitTextToSize(text, pageWidth - margin * 2);
    pdf.text(lines, margin, 20);
    pdf.save(`extracted_telugu.pdf`);
  };

  const downloadDocx = () => {
    const doc = new Document({
      sections: [{ properties: {}, children: [new Paragraph({ children: [new TextRun(text)] })] }],
    });
    Packer.toBlob(doc).then((blob) => saveAs(blob, `extracted_telugu.docx`));
  };

  const handleFormatAndDownload = (format: string) => {
    setIsMenuOpen(false);
    if (!text) return;
    if (format === "pdf") downloadPdf();
    else if (format === "docx") downloadDocx();
    else downloadTxt();
  };

  const handleCheckSpelling = async () => {
    if (!text) return;
    setStatus("Checking spelling…");
    setSpellCheck(true);
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND}/api/spellcheck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error("spellcheck failed");
      const data = await response.json();
      setSpellCheckResults(data.results || []);
      setStatus("Done");
    } catch (error) {
      console.error("Spell check failed", error);
      const words = Array.from(new Set(text.split(/\s+/).filter(Boolean)));
      setSpellCheckResults(
        words.map((w) => ({
          word: w, hamming: "—", lcs: "—", levenshtein: "—", zaro: "—",
          benchmark: "Correct", segmentation: "",
        })),
      );
      setStatus("Backend offline — showing local placeholder results");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyClick = (char: string) => setText((prev) => prev + char);

  const handlePhoneticChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setEnglishInput(input);
    if (input.endsWith(" ")) {
      const wordToTransliterate = input.trim();
      if (!wordToTransliterate) return;
      try {
        const response = await fetch(`${BACKEND}/api/transliterate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: wordToTransliterate }),
        });
        const data = await response.json();
        setText((prev) => prev + (data.transliterated_text || wordToTransliterate) + " ");
      } catch {
        setText((prev) => prev + wordToTransliterate + " ");
      }
      setEnglishInput("");
    }
  };

  return (
    <div className="min-h-screen mesh-bg">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-10 md:py-14">
        <header className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-primary to-primary-glow shadow-(--shadow-elevated) flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
                <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="text-2xl font-ibm-sans tracking-wide uppercase font-bold text-gradient-primary">
              <span className="text-foreground -tracking-widest">tel</span>vision
            </div>
          </div>
          <Link
            href="/tokenizer"
            className="text-sm font-ibm-sans tracking-wide uppercase font-medium px-4 py-2 rounded-full glass hover:bg-accent/40 transition-all"
          >
            <span className="-tracking-widest">tel</span>tokenizer →
          </Link>
        </header>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="glass rounded-3xl p-6 flex flex-col gap-5 h-fit">

            <div className="relative group">
              <button
                type="button"
                className={`w-full aspect-square rounded-2xl border-2 border-dashed border-primary/30 bg-linear-to-br from-primary/5 to-primary-glow/5 flex flex-col items-center justify-center gap-3 hover:from-primary/10 hover:to-primary-glow/10 hover:border-primary/50 transition-all ${isLoading ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
                ) : (
                  <>
                    <div className="h-14 w-14 rounded-2xl bg-linear-to-br from-primary to-primary-glow flex items-center justify-center shadow-(--shadow-elevated)">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="h-7 w-7 fill-primary-foreground">
                        <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-foreground text-center px-2">Click to upload Telugu image</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
                  </>
                )}
              </button>
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg"
                disabled={isLoading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                onChange={handleImageUpload}
              />
            </div>

            {status && (
              <div className="text-xs font-medium text-muted-foreground px-3 py-2 rounded-lg bg-accent/40 border border-border text-center">
                {status}
              </div>
            )}
          </aside>

          <section className="flex flex-col gap-5">
            <div className="relative glass rounded-3xl p-2">
              <textarea
                placeholder="Extracted Telugu text will appear here. You can also type directly…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="font-telugu w-full h-80 resize-none rounded-2xl bg-background/40 p-5 pr-14 text-base leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/70"
              />
              {text && (
                <button
                  onClick={handleCopyToClipboard}
                  className="absolute top-5 right-5 p-2.5 rounded-xl bg-background/50 backdrop-blur border border-border text-muted-foreground hover:text-foreground hover:bg-background/80 transition-all shadow-sm"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                    </svg>
                  )}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  disabled={!text}
                  className={`px-5 py-2.5 rounded-full text-sm font-semibold glass hover:bg-accent/40 transition-all ${!text ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  Download ↓
                </button>
                {isMenuOpen && (
                  <div className="absolute left-0 z-40 mt-2 w-44 rounded-2xl glass-strong overflow-hidden p-1.5">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Export as
                    </div>
                    {[
                      { fmt: "txt", label: "Plain text (.txt)" },
                      { fmt: "docx", label: "Word (.docx)" },
                      { fmt: "pdf", label: "PDF (.pdf)" },
                    ].map((opt) => (
                      <button
                        key={opt.fmt}
                        onClick={() => handleFormatAndDownload(opt.fmt)}
                        className="block w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-primary/10 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleCheckSpelling}
                disabled={!text || isLoading}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold text-primary-foreground bg-linear-to-br from-primary to-primary-glow shadow-(--shadow-elevated) hover:opacity-90 transition-all ${!text || isLoading ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Check Spelling
              </button>

              <button
                onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${isKeyboardOpen
                  ? "bg-foreground text-background"
                  : "glass hover:bg-accent/40"
                  }`}
              >
                {isKeyboardOpen ? "Close keyboard" : "Keyboard"}
              </button>

              <button
                title="for future purposes"
                className="h-10 w-10 shrink-0 rounded-full glass hover:bg-accent/40 transition-all flex items-center justify-center text-muted-foreground hover:text-foreground cursor-help"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" x2="12" y1="19" y2="22" />
                </svg>
              </button>

              <button
                onClick={() => { setText(""); setSpellCheckResults([]); setSpellCheck(false); }}
                disabled={!text}
                className={`px-5 py-2.5 rounded-full text-sm font-semibold glass hover:bg-destructive/10 hover:text-destructive transition-all ml-auto ${!text ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Words", value: stats.wordCount },
                { label: "Sentences", value: stats.sentenceCount },
                { label: "Characters", value: stats.charCount },
                { label: "Avg word len", value: stats.avgWordLength > 0 ? stats.avgWordLength.toFixed(2) : "0" },
              ].map((s) => (
                <div key={s.label} className="glass rounded-2xl px-4 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </div>
                  <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{s.value}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {isKeyboardOpen && (
          <div className="mt-6 glass rounded-3xl p-6 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <h2 className="text-lg font-bold">Telugu Keyboard</h2>
              <div className="flex gap-1.5 p-1 rounded-full bg-muted/50">
                <button
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${keyboardMode === "inscript"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                  onClick={() => setKeyboardMode("inscript")}
                >
                  Script
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${keyboardMode === "phonetic"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                  onClick={() => setKeyboardMode("phonetic")}
                >
                  Phonetic (Eng → Tel)
                </button>
              </div>
            </div>

            {keyboardMode === "inscript" ? (
              <div className="space-y-3">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[...TELUGU_CHARS.modifiers, ...TELUGU_CHARS.vattulu].map((char, idx) => (
                    <button
                      key={`modvat-${idx}`}
                      onClick={() => handleKeyClick(char)}
                      className="font-telugu min-w-9 h-9 px-1.5 rounded-md border bg-linear-to-br from-primary-glow/15 to-primary-glow/5 border-primary-glow/30 text-base font-medium hover:scale-105 hover:shadow-(--shadow-glass) transition-all flex items-center justify-center"
                    >
                      {char}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap justify-center gap-1.5">
                  {TELUGU_CHARS.vowels.map((char, idx) => (
                    <button
                      key={`vow-${idx}`}
                      onClick={() => handleKeyClick(char)}
                      className="font-telugu min-w-9 h-9 px-1.5 rounded-md border bg-linear-to-br from-primary/15 to-primary/5 border-primary/30 text-base font-medium hover:scale-105 hover:shadow-(--shadow-glass) transition-all flex items-center justify-center"
                    >
                      {char}
                    </button>
                  ))}
                  {TELUGU_CHARS.consonants.map((char, idx) => (
                    <button
                      key={`con-${idx}`}
                      onClick={() => handleKeyClick(char)}
                      className="font-telugu min-w-9 h-9 px-1.5 rounded-md border bg-linear-to-br from-accent to-background border-border text-base font-medium hover:scale-105 hover:shadow-(--shadow-glass) transition-all flex items-center justify-center"
                    >
                      {char}
                    </button>
                  ))}
                </div>

                <div className="flex justify-center gap-2 mt-2">
                  <button onClick={() => setText((prev) => prev.slice(0, -1))}
                    className="w-16 h-9 rounded-md border bg-linear-to-br from-accent to-background border-border text-sm font-semibold hover:scale-105 hover:shadow-(--shadow-glass) transition-all flex items-center justify-center">
                    ⌫
                  </button>
                  <button onClick={() => handleKeyClick(' ')}
                    className="grow max-w-40 h-9 rounded-md border bg-linear-to-br from-accent to-background border-border text-xs font-semibold hover:scale-105 hover:shadow-(--shadow-glass) transition-all flex items-center justify-center uppercase tracking-wider">
                    Space
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-background/40 p-6 text-center">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Type phonetically in English and press <b>SPACE</b> to get Telugu script:
                </label>
                <input
                  type="text"
                  className="w-full sm:w-3/4 px-5 py-2 text-lg rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  value={englishInput}
                  onChange={handlePhoneticChange}
                  placeholder=""
                />
              </div>
            )}
          </div>
        )}

        {isSpellCheck && spellCheckResults.length > 0 && (
          <div className="mt-6 glass rounded-3xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Spell Check Results</h3>
              <span className="text-xs text-muted-foreground">{spellCheckResults.length} words analyzed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    {["Word", "Hamming", "LCS", "Levenshtein", "Zaro", "Benchmark", "Backoff"].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left font-semibold text-xs uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {spellCheckResults.map((result, idx) => (
                    <tr key={idx} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 font-telugu font-semibold">{result.word}</td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{result.hamming}</td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{result.lcs}</td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{result.levenshtein}</td>
                      <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{result.zaro}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ${result.benchmark === "Correct"
                            ? "bg-(--success)/15 text-(--success)"
                            : "bg-destructive/15 text-destructive"
                            }`}
                        >
                          {result.benchmark}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-telugu">
                        {result.benchmark === "Correct" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : result.segmentation?.includes(" + ") ? (
                          <>
                            <span className="text-(--success)">{result.segmentation.split(" + ")[0]}</span>
                            <span className="text-muted-foreground mx-1">+</span>
                            <span className="text-destructive">{result.segmentation.split(" + ")[1]}</span>
                          </>
                        ) : (
                          <span className="text-destructive">{result.segmentation}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex mt-12 pt-10 items-center justify-center">
          <Link href="mailto:surya.thota45@gmail.com">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333333" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-mail size-5"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
          </Link>

          <Link href="/https://www.github.com/suryaat19/telvision" className="ml-4">
            <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="#333333" className="size-5">
              <title>GitHub</title>
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </Link>
        </div>
        <footer className="mt-12 pt-10 w-full flex justify-center pb-10">
          <p className="text-sm text-gray-400">
            Copyright © 2026 Surya Thota - All Rights Reserved.
          </p>
        </footer>
      </div>

    </div>
  );
}