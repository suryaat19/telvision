"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LineChart, Line, Legend, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";

const VOCAB_SIZES = [
    { value: 8000, label: "8K (8,000)" },
    { value: 16000, label: "16K (16,000)" },
    { value: 32000, label: "32K (32,000)" },
    { value: 64000, label: "64K (64,000)" },
    { value: 128000, label: "128K (128,000)" },
    { value: 256000, label: "256K (256,000)" },
];

const HIGHLIGHT_COLORS = [
    "bg-blue-100 dark:bg-blue-900/50",
    "bg-yellow-100 dark:bg-yellow-900/50",
    "bg-green-100 dark:bg-green-900/50",
    "bg-red-100 dark:bg-red-900/50",
    "bg-cyan-100 dark:bg-cyan-900/50",
    "bg-purple-100 dark:bg-purple-900/50",
    "bg-indigo-100 dark:bg-indigo-900/50"
];

interface TopMerge {
    pair: string;
    count: number;
}

interface ModelStat {
    vocabSize: number;
    avgTokensPerWord: number;
    "compression(%)": number;
    "oovRate(%)": number;
    "tokenizationTime(s)": number;
    "memory(KB)": number;
    uniqueSubwords: number;
    topMerges: TopMerge[];
    note?: string;
}

export default function Tokenizer() {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [status, setStatus] = useState<string>("");

    const [isTraining, setIsTraining] = useState<boolean>(false);
    const [trainingProgress, setTrainingProgress] = useState<number>(0);

    const [corpusText, setCorpusText] = useState<string>("");
    const [inputText, setInputText] = useState<string>("");
    const [vocabSize, setVocabSize] = useState<number>(8000);
    const [tokenizedChunks, setTokenizedChunks] = useState<string[]>([]);

    const [modelStats, setModelStats] = useState<ModelStat[]>([]);
    const [graphData, setGraphData] = useState<any>(null);
    const [initialVocabSize, setInitialVocabSize] = useState<number | null>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);

        const reader = new FileReader();
        reader.onload = (event) => {
            setCorpusText(event.target?.result as string);
            setIsLoading(false);
            setModelStats([]);
            setGraphData(null);
            setInitialVocabSize(null);
        };
        reader.onerror = () => {
            setStatus("Error reading file");
            setIsLoading(false);
        };
        reader.readAsText(file);
    };

    const handleRunBPETraining = async () => {
        if (!corpusText) return;

        setIsLoading(true);
        setIsTraining(true);
        setTrainingProgress(0);
        setStatus("");

        const progressInterval = setInterval(() => {
            setTrainingProgress((prev) => {
                if (prev >= 95) return prev;
                return prev + 1;
            });
        }, 600);

        try {
            const response = await fetch("http://127.0.0.1:8000/api/train", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: corpusText }),
            });

            clearInterval(progressInterval);
            const data = await response.json();

            if (response.ok) {
                setTrainingProgress(100);
                setModelStats(data.stats);
                setGraphData(data.graphs);
                setInitialVocabSize(data.initial_vocab_size);

                setTimeout(() => {
                    setIsTraining(false);
                }, 1500);
            } else {
                setIsTraining(false);
                setStatus(`Backend Error: ${data.detail}`);
            }
        } catch (error) {
            clearInterval(progressInterval);
            setIsTraining(false);
            console.error(error);
            setStatus("Failed to connect to Python backend.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setInputText(e.target.value);
    };

    useEffect(() => {
        const fetchTokens = async () => {
            if (!inputText) {
                setTokenizedChunks([]);
                return;
            }

            try {
                const response = await fetch("http://127.0.0.1:8000/api/tokenize", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ text: inputText, vocab_size: vocabSize }),
                });

                if (response.ok) {
                    const data = await response.json();
                    setTokenizedChunks(data.tokens);
                } else {
                    const errorData = await response.json();
                    setStatus(`Inference error: ${errorData.detail}`);
                }
            } catch (error) {
                console.error("Tokenization failed:", error);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchTokens();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [inputText, vocabSize]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black font-ibm-sans">
            <main className="flex min-h-screen w-full max-w-6xl flex-col items-center justify-between pt-8 md:pt-16 md:px-16 px-4 bg-white dark:bg-black sm:items-start pb-16">

                <div className="flex items-center justify-between w-full mb-8">
                    <div className="uppercase text-2xl font-ibm-sans font-bold tracking-wide text-foreground dark:text-white mb-8">
                        <span className="-tracking-widest">tex</span>tokenizer
                    </div>
                    <Link href="/">
                        <div className="uppercase text-2xl font-ibm-sans font-bold tracking-wide text-foreground/50 hover:text-foreground dark:text-white/50 dark:hover:text-white transition-colors mb-8 cursor-pointer">
                            <span className="-tracking-widest">tex</span>vision
                        </div>
                    </Link>
                </div>

                <div className="grid-cols-1 md:grid-cols-4 grid gap-8 w-full">

                    <div className="flex flex-col gap-6 items-start text-left">
                        <div className="relative group">
                            <button type="button"
                                className={`p-14 bg-zinc-100 rounded-sm border border-dashed border-foreground/30 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-foreground/60 dark:hover:bg-zinc-800 transition-colors flex justify-center ${isLoading && !isTraining ? "opacity-50 cursor-wait" : ""}`}
                            >
                                {isLoading && !isTraining ? (
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="currentColor" className="text-foreground">
                                            <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                            <input type="file" accept=".txt" disabled={isLoading} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" onChange={handleFileUpload} />
                        </div>

                        <button onClick={handleRunBPETraining} disabled={isLoading || !corpusText}
                            className="text-center rounded-xl font-medium px-4 py-3 text-sm transition-colors dark:text-zinc-800 text-zinc-200 bg-zinc-950 dark:bg-zinc-50 dark:hover:bg-zinc-100 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Train BPE Models
                        </button>

                        <div className="h-6 w-full">
                            {isTraining ? (
                                <div className="flex items-center w-full gap-3">
                                    <div className="grow h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-black dark:bg-white transition-all duration-300 ease-out"
                                            style={{ width: `${trainingProgress}%` }}
                                        ></div>
                                    </div>
                                    <span className="text-xs font-ibm-mono font-medium text-zinc-600 dark:text-zinc-400 min-w-12">
                                        {trainingProgress}%
                                    </span>
                                </div>
                            ) : (
                                status && <p className="text-sm font-medium text-red-500">{status}</p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 w-full col-span-3">
                        <div className="flex justify-between items-end">
                            <label className="text-sm font-semibold uppercase tracking-wider text-foreground/50 dark:text-foreground/70 block">
                                Tokenize Text
                            </label>
                            <select
                                value={vocabSize}
                                onChange={(e) => setVocabSize(Number(e.target.value))}
                                disabled={isLoading || modelStats.length === 0}
                                className="w-40 p-1.5 rounded-sm border border-zinc-300 dark:bg-zinc-900 text-foreground text-sm focus:outline-none focus:border-foreground"
                            >
                                {VOCAB_SIZES.map((size) => (
                                    <option key={size.value} value={size.value}>{size.label}</option>
                                ))}
                            </select>
                        </div>

                        <textarea
                            placeholder="Enter text to tokenize here..."
                            value={inputText}
                            onChange={handleTextChange}
                            disabled={modelStats.length === 0}
                            className="h-32 w-full resize-none rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-foreground font-ibm-mono dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:outline-none focus:border-zinc-400 transition-colors disabled:opacity-50">
                        </textarea>

                        <div className="w-full min-h-32 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-inner font-ibm-mono text-lg leading-loose wrap-break-word">
                            {tokenizedChunks.length === 0 ? (
                                <span className="text-zinc-400 text-sm font-sans">Tokenized output will appear here after training...</span>
                            ) : (
                                tokenizedChunks.map((chunk, index) => {
                                    if (chunk.trim() === "") return <span key={index}>{chunk}</span>;

                                    const colorClass = HIGHLIGHT_COLORS[index % HIGHLIGHT_COLORS.length];
                                    return (
                                        <span key={index} className={`${colorClass} rounded-sm px-0.5 text-zinc-900 dark:text-zinc-100`}>
                                            {chunk}
                                        </span>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {initialVocabSize && (
                    <div className="mb-4 text-sm text-zinc-500">
                        Initial Vocabulary Size: {initialVocabSize}
                    </div>
                )}


                {modelStats.length > 0 && (
                    <div className="mt-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {modelStats.map((stat) => (
                                <div key={stat.vocabSize} className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 p-5 shadow-sm flex flex-col">
                                    <h3 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300 mb-4">
                                        Vocabulary Statistics ({stat.vocabSize >= 1000 ? `${stat.vocabSize / 1000}K` : stat.vocabSize})
                                    </h3>

                                    <div className="grid grid-cols-2 gap-3 grow">

                                        <div className="bg-zinc-100 dark:bg-zinc-900/80 p-3 rounded-lg flex flex-col justify-center border border-zinc-200 dark:border-zinc-800">
                                            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Avg Tokens / Word</p>
                                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                {stat.avgTokensPerWord}
                                            </p>
                                        </div>

                                        <div className="bg-zinc-100 dark:bg-zinc-900/80 p-3 rounded-lg flex flex-col justify-center border border-zinc-200 dark:border-zinc-800">
                                            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Compression</p>
                                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                {stat["compression(%)"]}%
                                            </p>
                                        </div>

                                        <div className="bg-zinc-100 dark:bg-zinc-900/80 p-3 rounded-lg flex flex-col justify-center border border-zinc-200 dark:border-zinc-800">
                                            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">OOV Rate</p>
                                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                {stat["oovRate(%)"]}%
                                            </p>
                                        </div>

                                        <div className="bg-zinc-100 dark:bg-zinc-900/80 p-3 rounded-lg flex flex-col justify-center border border-zinc-200 dark:border-zinc-800">
                                            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Tokenization Time</p>
                                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                {stat["tokenizationTime(s)"]}s
                                            </p>
                                        </div>

                                        <div className="bg-zinc-100 dark:bg-zinc-900/80 p-3 rounded-lg flex flex-col justify-center border border-zinc-200 dark:border-zinc-800">
                                            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Memory</p>
                                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                {stat["memory(KB)"]} KB
                                            </p>
                                        </div>

                                        <div className="bg-zinc-100 dark:bg-zinc-900/80 p-3 rounded-lg flex flex-col justify-center border border-zinc-200 dark:border-zinc-800">
                                            <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">Unique Subwords</p>
                                            <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                                {stat.uniqueSubwords}
                                            </p>
                                        </div>

                                    </div>
                                </div>

                            ))}


                        </div>
                        {graphData && (
                            <div className="mt-10 grid md:grid-cols-2 gap-6">

                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={graphData.vocab_vs_compression}>
                                            <ReferenceLine y={80} stroke="red" strokeDasharray="3 3" />
                                            <defs>
                                                <linearGradient id="colorCompression" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>

                                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />

                                            <XAxis
                                                dataKey="vocabSize"
                                                tickFormatter={(v) => `${v / 1000}K`}
                                                label={{ value: "Vocabulary Size", position: "insideBottom", offset: -5 }}
                                            />

                                            <YAxis
                                                domain={[0, 100]}
                                                label={{ value: "Compression (%)", angle: -90, position: "insideLeft" }}
                                            />

                                            <Tooltip
                                                contentStyle={{ borderRadius: "8px", border: "none" }}
                                            />

                                            <Legend />

                                            <Line
                                                type="monotone"
                                                dataKey="compression"
                                                name="Compression (%)"
                                                stroke="#6366f1"
                                                strokeWidth={3}
                                                dot={{ r: 4 }}
                                                activeDot={{ r: 7 }}
                                                animationDuration={800}
                                                fill="url(#colorCompression)"
                                            />

                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={graphData.vocab_vs_tokens}>
                                            <ReferenceLine y={80} stroke="red" strokeDasharray="3 3" />
                                            <defs>
                                                <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>

                                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.3} />

                                            <XAxis
                                                dataKey="vocabSize"
                                                tickFormatter={(v) => `${v / 1000}K`}
                                            />

                                            <YAxis
                                                label={{ value: "Avg Tokens / Word", angle: -90, position: "insideLeft" }}
                                            />

                                            <Tooltip contentStyle={{ borderRadius: "8px", border: "none" }} />
                                            <Legend />

                                            <Line
                                                type="monotone"
                                                dataKey="avgTokensPerWord"
                                                name="Avg Tokens / Word"
                                                stroke="#10b981"
                                                strokeWidth={3}
                                                dot={{ r: 4 }}
                                                activeDot={{ r: 7 }}
                                                animationDuration={800}
                                                fill="url(#colorTokens)"
                                            />

                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>

                            </div>
                        )}
                    </div>
                )}

            </main>
        </div>
    );
}