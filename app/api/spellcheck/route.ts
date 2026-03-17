import { NextResponse } from 'next/server';
import { spellCheck } from '@/app/utils/stats'; 

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, langCode } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const results = await spellCheck(text, langCode || 'eng');

    return NextResponse.json({ results });

  } catch (error: any) {
    console.error("API Spellcheck Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}