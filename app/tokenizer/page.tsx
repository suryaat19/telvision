"use client";
import { useState, useEffect, type ChangeEvent } from "react";
import Link from "next/link";

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

const HIGHLIGHT_COLORS = [
    "bg-primary/15 text-primary",
    "bg-blue-500/15 text-blue-500",
    "bg-emerald-500/15 text-emerald-500",
    "bg-purple-500/15 text-purple-500",
    "bg-amber-500/15 text-amber-500",
    "bg-pink-500/15 text-pink-500"
];

const BACKEND = "https://suryaat19-telvision-api.hf.space";

export default function Tokenizer() {
    const [text, setText] = useState("");
    const [englishInput, setEnglishInput] = useState("");
    const [keyboardMode, setKeyboardMode] = useState<"inscript" | "phonetic">("inscript");

    const [tokenizedChunks, setTokenizedChunks] = useState<string[]>([]);
    const [isTokenizing, setIsTokenizing] = useState(false);

    useEffect(() => {
        const fetchTokens = async () => {
            if (!text.trim()) {
                setTokenizedChunks([]);
                return;
            }

            setIsTokenizing(true);
            try {
                const response = await fetch(`${BACKEND}/api/tokenize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setTokenizedChunks(data.tokens);
                } else {
                    console.error("Tokenization failed");
                }
            } catch (error) {
                console.error("Backend connection failed:", error);
            } finally {
                setIsTokenizing(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchTokens();
        }, 400);

        return () => clearTimeout(timeoutId);
    }, [text]);

    const handleKeyClick = (char: string) => {
        setText((prev) => prev + char);
    };

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
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-primary to-primary-glow shadow-(--shadow-elevated) flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary-foreground">
                                <path d="M4 6h16M4 12h10M4 18h16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                            </svg>
                        </div>
                        <div className="text-2xl font-ibm-sans tracking-wide uppercase font-bold text-gradient-primary">
                            <span className="text-foreground -tracking-widest">tel</span>tokenizer
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="text-sm font-ibm-sans tracking-wide uppercase font-medium px-4 py-2 rounded-full glass hover:bg-accent/40 transition-all"
                    >
                    <span className="-tracking-widest">tel</span>vision &#8594;
                    </Link>
                    
                </header>

                <div className="grid gap-6 lg:grid-cols-2">

                    <aside className="order-2 lg:order-1 glass rounded-3xl p-4 sm:p-5 flex flex-col gap-4 h-fit">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                            <h2 className="text-base font-bold">Telugu Keyboard</h2>
                            <div className="flex gap-1 p-1 rounded-full bg-muted/50">
                                <button
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${keyboardMode === "inscript"
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    onClick={() => setKeyboardMode("inscript")}
                                >
                                    Script
                                </button>
                                <button
                                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${keyboardMode === "phonetic"
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    onClick={() => setKeyboardMode("phonetic")}
                                >
                                    Phonetic
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
                            <div className="rounded-2xl border border-border bg-background/40 p-5 text-center">
                                <label className="block text-sm font-medium text-foreground mb-3">
                                    Type phonetically (e.g. "namaskaram") and press <b>SPACE</b>:
                                </label>
                                <input
                                    type="text"
                                    className="w-full sm:w-3/4 px-4 py-2 text-base rounded-xl bg-background border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                                    value={englishInput}
                                    onChange={handlePhoneticChange}
                                    placeholder="namaste…"
                                />
                            </div>
                        )}
                    </aside>

                    <section className="order-1 lg:order-2 flex flex-col gap-4 h-full">

                        <div className="glass rounded-3xl p-2">
                            <textarea
                                placeholder="Type using the keyboard or paste Telugu text here…"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="font-telugu w-full h-40 resize-none rounded-2xl bg-background/40 p-5 text-base leading-relaxed text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition placeholder:text-muted-foreground/70"
                            />
                        </div>

                        <div className="flex justify-between items-center mx-1">
                            <h3 className="font-semibold text-lg rounded-full px-3 py-1 bg-linear-to-r from-primary to-primary-glow text-white inline-block">
                                Tokenized Output &darr;
                            </h3>
                            <button
                                onClick={() => setText("")}
                                disabled={!text}
                                className={`px-6 py-2 rounded-full text-sm font-semibold glass hover:bg-destructive/10 hover:text-destructive transition-all ${!text ? "opacity-40 cursor-not-allowed" : ""}`}
                            >
                                Clear
                            </button>
                        </div>

                        <div className="glass rounded-3xl p-5 flex flex-col grow">
                            <div className="flex justify-between items-center">
                                {isTokenizing && (
                                    <span className="text-xs font-semibold text-primary animate-pulse mb-3">Processing…</span>
                                )}
                            </div>
                            <div className="w-full min-h-48 rounded-2xl border border-border bg-background/40 p-4 text-base leading-loose wrap-break-words grow">
                                {tokenizedChunks.length === 0 ? (
                                    <span className="text-muted-foreground/60 text-sm font-medium">Tokenized chunks will appear here automatically…</span>
                                ) : (
                                    <div className="flex flex-wrap gap-1 items-center">
                                        {tokenizedChunks.map((chunk, index) => {
                                            if (chunk.trim() === "") return <span key={index}>{chunk}</span>;
                                            const colorClass = HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
                                            return (
                                                <span key={index} className={`font-telugu ${colorClass} rounded-md px-2 py-0.5 font-medium shadow-sm transition-colors`}>
                                                    {chunk}
                                                </span>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                    </section>

                </div>
            </div>
        </div>
    );
}