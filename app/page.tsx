"use client";
import { useState, useRef, useEffect } from "react";
import Tesseract from "tesseract.js";
import jsPDF from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";
import html2canvas from "html2canvas";
import { getTextArea, getWordCount, getSentenceCount, getCharacterCount, getAverageWordLength } from "./utils/clientStats";

const LANGUAGES = [
  { code: 'tel', label: 'Telugu (తెలుగు)' },
  { code: 'eng', label: 'English' },
];

export interface SpellCheckResult {
  word: string;
  hamming: string | number;
  lcs: string | number;
  levenshtein: string | number;
  zaro: string | number;
  benchmark: "Correct" | "Wrong";
  segmentation: string;
}

export default function Home() {
  const [text, setText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<string>("");
  const [language, setLanguage] = useState<string>("tel");
  const [downloadFormat, setDownloadFormat] = useState<string>("txt");

  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSpellCheck, setSpellCheck] = useState<boolean>(false);
  const [spellCheckResults, setSpellCheckResults] = useState<SpellCheckResult[]>([]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatus("Initializing...");
    setText("");
    setSpellCheck(false);
    setSpellCheckResults([]);

    try {
      const result = await Tesseract.recognize(
        file,
        language,
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setStatus(`Processing: ${Math.round(m.progress * 100)}%`);
            } else {
              setStatus(m.status.replace(/_/g, " "));
            }
          },
        }
      );

      setText(result.data.text);
      setStatus("Done!");
    } catch (err) {
      console.error(err);
      setStatus("Error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTxt = () => {
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `extracted_${language}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const downloadPdf = async () => {
    if (!text) return;

    const printDiv = document.createElement("div");
    printDiv.style.width = "794px";
    printDiv.style.padding = "40px";
    printDiv.style.whiteSpace = "pre-wrap";
    printDiv.style.fontFamily = "sans-serif";
    printDiv.style.fontSize = "16px";
    printDiv.style.color = "black";
    printDiv.style.backgroundColor = "white";
    printDiv.style.lineHeight = "1.6";

    printDiv.innerText = text;

    printDiv.style.position = "absolute";
    printDiv.style.top = "-9999px";
    printDiv.style.left = "-9999px";
    document.body.appendChild(printDiv);

    try {
      const canvas = await html2canvas(printDiv, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`extracted_${language}.pdf`);

    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      document.body.removeChild(printDiv);
    }
  };

  const downloadDocx = () => {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun(text),
              ],
            }),
          ],
        },
      ],
    });

    Packer.toBlob(doc).then((blob) => {
      saveAs(blob, `extracted_${language}.docx`);
    });
  };

  const handleFormatAndDownload = (format: string) => {
    setDownloadFormat(format);
    setIsMenuOpen(false);

    if (!text) return;

    switch (format) {
      case "pdf":
        downloadPdf();
        break;
      case "docx":
        downloadDocx();
        break;
      case "txt":
      default:
        downloadTxt();
        break;
    }
  };

  const handleCheckSpelling = async () => {
    setIsMenuOpen(false);
    if (!text) return;

    setStatus("Checking spelling algorithms...");
    setSpellCheck(true);
    setIsLoading(true);

    try {
      const response = await fetch('/api/spellcheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, langCode: language }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch spell check results");
      }

      const data = await response.json();
      setSpellCheckResults(data.results);
      setStatus("Done!");
    } catch (error) {
      console.error("Spell check failed", error);
      setStatus("Spell check failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black font-ibm-sans">
      <main className="flex min-h-screen w-full max-w-5xl flex-col items-center justify-between pt-8 md:pt-16 md:px-16 px-4 bg-white dark:bg-black sm:items-start">
        <div className="uppercase text-2xl font-ibm-sans font-bold tracking-wide text-foreground dark:text-white mb-8">
          <span className="-tracking-widest">tex</span>vision
        </div>

        <div className="grid-cols-1 md:grid-cols-2 grid gap-4 md:gap-32 w-full">
          <div className="hidden md:flex flex-col gap-6 items-start text-left">
            <div className="w-full max-w-50">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50 dark:text-foreground/70 mb-1.5 block">
                Select Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isLoading}
                className="w-full p-2 rounded-sm border border-zinc-300 dark:bg-zinc-900 text-foreground text-sm focus:outline-none focus:border-foreground"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="relative group">
              <button
                type="button"
                className={`p-16 bg-zinc-100 rounded-sm border border-dashed border-foreground/30 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-foreground/60 dark:hover:bg-zinc-800 transition-colors ${isLoading ? "opacity-50 cursor-wait" : ""}`}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-12 w-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                  </div>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="currentColor" className="text-foreground">
                    <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                  </svg>
                )}
              </button>
              <input type="file" accept="image/png, image/jpeg, image/jpg" disabled={isLoading} className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed" onChange={handleImageUpload} />
            </div>

            <div className="h-6">
              {status && <p className="text-sm font-medium text-foreground/70 animate-pulse capitalize">{status}</p>}
            </div>

            <h1 className="max-w-sm md:text-lg text-xs font-light leading-tight text-black dark:text-zinc-50">
              Upload an image containing text in your chosen language.
            </h1>
          </div>

          <div className="md:hidden flex flex-col items-center gap-6 text-center">
            <div className="w-full max-w-50 flex justify-between items-center gap-4">
              <label className="text-xs font-semibold uppercase tracking-wider text-foreground/50 dark:text-foreground/70 mb-1.5 block">
                Select Language
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={isLoading}
                className="w-full p-2 rounded-sm border border-foreground/30 bg-white dark:bg-zinc-900 text-foreground text-sm focus:outline-none focus:border-foreground"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-between items-center gap-6">
              <div className="relative group">
                <button
                  type="button"
                  className={`p-16 bg-zinc-100 rounded-sm border border-dashed border-foreground/30 hover:bg-zinc-200 dark:bg-zinc-900 dark:border-foreground/60 dark:hover:bg-zinc-800 transition-colors ${isLoading ? "opacity-50 cursor-wait" : ""}`}
                >
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-12 w-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
                    </div>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      height="48px"
                      viewBox="0 -960 960 960"
                      width="48px"
                      fill="currentColor"
                      className="text-foreground"
                    >
                      <path d="M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
                    </svg>
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
              <div className="flex flex-col">
                <div className="h-6">
                  {status && <p className="text-sm font-medium text-foreground/70 animate-pulse capitalize">{status}</p>}
                </div>

                <h1 className="max-w-sm text-sm font-light leading-tight text-black dark:text-zinc-50">
                  Upload an image containing text in your chosen language.
                </h1>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6 w-full">
            <textarea readOnly placeholder="Extracted text will appear here..." value={getTextArea(text)} className="h-84 w-full resize-none rounded-xl bg-zinc-50 p-4 text-sm leading-relaxed text-foreground dark:bg-zinc-900 dark:border-foreground/60 dark:text-foreground focus:outline-none"></textarea>

            <div className="flex items-center justify-around gap-4 w-full">
              <div className="relative inline-block text-left" ref={dropdownRef}>
                <button onClick={() => setIsMenuOpen(!isMenuOpen)} disabled={!text} className={`flex items-center rounded-xl font-medium text-sm dark:text-white text-black border-zinc-200 dark:border-zinc-700 border px-4 py-2 transition-colors focus:outline-none ${!text ? "cursor-not-allowed opacity-50" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}>
                  Download
                </button>

                {isMenuOpen && (
                  <div className="absolute left-0 z-40 w-42 mt-2 origin-top-left rounded-xl bg-white dark:bg-zinc-900 shadow-md focus:outline-none border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                    <div className="p-2">
                      <div className="px-2 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Download as</div>
                      <button onClick={() => handleFormatAndDownload('txt')} className="block w-full text-left px-2 py-2 text-sm rounded-md text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Txt</button>
                      <button onClick={() => handleFormatAndDownload('docx')} className="block w-full text-left px-2 py-2 text-sm rounded-md text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Docx</button>
                      <button onClick={() => handleFormatAndDownload('pdf')} className="block w-full text-left px-2 py-2 text-sm rounded-md text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">Pdf</button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleCheckSpelling}
                disabled={!text || isLoading}
                className={`block text-left rounded-xl font-medium px-4 py-2 text-sm transition-colors ${!text || isLoading ? "opacity-50 cursor-not-allowed bg-zinc-800 text-zinc-400" : "dark:text-zinc-800 text-zinc-200 bg-zinc-950 dark:bg-zinc-50 dark:hover:bg-zinc-100 hover:bg-zinc-800"}`}
              >
                Check Spelling
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col my-8 items-center w-full gap-4">
          <div className="hidden md:block rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50 z-10 shadow-sm overflow-hidden w-full">
            <table className="text-left w-full text-sm whitespace-nowrap">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium tracking-wide">No. of Words</th>
                  <th className="px-4 py-2 font-medium tracking-wide">No. of Sentences</th>
                  <th className="px-4 py-2 font-medium tracking-wide">No. of Characters</th>
                  <th className="px-4 py-2 font-medium tracking-wide">Avg. Word Length</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getWordCount(text)}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getSentenceCount(text)}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getCharacterCount(text)}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getAverageWordLength(text) > 0 ? getAverageWordLength(text).toFixed(2) : "0"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="md:hidden block w-full rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50 z-10 shadow-sm overflow-hidden">
            <table className="text-left w-full text-sm whitespace-nowrap">
              <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2 font-medium tracking-wide">No. of Words</th>
                  <th className="px-4 py-2 font-medium tracking-wide">No. of Sent.</th>
                  <th className="px-4 py-2 font-medium tracking-wide">No. of Chars</th>
                  <th className="px-4 py-2 font-medium tracking-wide">Avg. Word Len</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getWordCount(text)}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getSentenceCount(text)}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getCharacterCount(text)}</td>
                  <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{getAverageWordLength(text) > 0 ? getAverageWordLength(text).toFixed(2) : "0"}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {isSpellCheck && spellCheckResults.length > 0 && (
            <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/50 z-10 shadow-sm w-full overflow-hidden">
              <div className="overflow-x-auto">
                <table className="text-left w-full text-sm whitespace-nowrap">
                  <thead className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
                    <tr>
                      <th className="px-4 py-2 font-medium tracking-wide">Word</th>
                      <th className="px-4 py-2 font-medium tracking-wide">Hamming</th>
                      <th className="px-4 py-2 font-medium tracking-wide">LCS</th>
                      <th className="px-4 py-2 font-medium tracking-wide">Levenshtein</th>
                      <th className="px-4 py-2 font-medium tracking-wide">Zaro</th>
                      <th className="px-4 py-2 font-medium tracking-wide">Benchmark</th>
                      <th className="px-4 py-2 font-medium tracking-wide">Backoff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {spellCheckResults.map((result, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <td className="px-4 py-2 font-semibold text-zinc-900 dark:text-zinc-50">{result.word}</td>
                        <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{result.hamming}</td>
                        <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{result.lcs}</td>
                        <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{result.levenshtein}</td>
                        <td className="px-4 py-2 text-zinc-700 dark:text-zinc-300">{result.zaro}</td>

                        <td className={`px-4 py-2 font-bold ${result.benchmark === 'Correct' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {result.benchmark}
                        </td>

                        <td className="px-4 py-2 font-bold">
                          {result.benchmark === 'Correct' ? (
                            <span className="text-green-600 dark:text-green-400">-</span>
                          ) : (
                            <span>
                              {result.segmentation?.includes(" + ") ? (
                                <>
                                  <span className="text-green-600 dark:text-green-400">
                                    {result.segmentation.split(" + ")[0]}
                                  </span>
                                  <span className="text-zinc-400 mx-1">+</span>
                                  <span className="text-red-600 dark:text-red-400">
                                    {result.segmentation.split(" + ")[1]}
                                  </span>
                                </>
                              ) : (
                                <span className="text-red-600 dark:text-red-400">
                                  {result.segmentation}
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}