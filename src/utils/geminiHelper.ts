const API_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY ?? '';
const CHAT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${API_KEY}`;
export interface GeminiMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export async function askGemini(
    userMessage: string,
    folderName: string,
    currentPageOcr: string,
    currentPageIndex: number,
    totalPages: number,
    folderSummary: string,
    history: GeminiMessage[]
): Promise<string> {

    const hasCurrentPage = currentPageOcr.trim().length > 0;
    const hasOtherPages = folderSummary.trim().length > 0;

    // Build the system prompt — current page is primary, rest is secondary
    const systemPrompt = `You are NoteCopilot, a friendly AI study assistant inside a student notes app called NoteVibe.

The student is studying "${folderName}" and is currently looking at Page ${currentPageIndex + 1} of ${totalPages}.

${hasCurrentPage
        ? `=== CURRENT PAGE (Page ${currentPageIndex + 1}) ===
${currentPageOcr}
=== END CURRENT PAGE ===

Answer questions primarily based on this page.`
        : `The current page (Page ${currentPageIndex + 1}) has not been scanned yet.`
    }

${hasOtherPages
        ? `=== OTHER PAGES IN THIS FOLDER (for reference only) ===
${folderSummary}
=== END OTHER PAGES ===`
        : ''
    }

Rules:
- Focus your answer on the CURRENT PAGE text first
- Only refer to other pages if the current page doesn't have the answer
- Be friendly, encouraging and concise
- Use bullet points for lists
- Keep responses under 250 words unless asked for more
- If a page hasn't been scanned, say so honestly`;

    const contents: GeminiMessage[] = [
        {
            role: 'user',
            parts: [{ text: systemPrompt }],
        },
        {
            role: 'model',
            parts: [{
                text: `Got it! I'm looking at Page ${currentPageIndex + 1} of your ${folderName} notes. Ready to help!`,
            }],
        },
        ...history,
        {
            role: 'user',
            parts: [{ text: userMessage }],
        },
    ];

    const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.warn('Gemini error:', response.status, errText);
        if (response.status === 400) throw new Error('API_KEY_INVALID');
        if (response.status === 429) throw new Error('QUOTA_EXCEEDED');
        if (response.status === 503) throw new Error('SERVICE_OVERLOADED');
        throw new Error(`GEMINI_ERROR_${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) throw new Error('EMPTY_RESPONSE');
    return text.trim();
}

// Build a brief summary of other pages for secondary context
// Keeps token usage low — only sends first 150 chars per page
export function buildFolderSummary(
    pages: string[],
    ocrText: Record<string, string>,
    currentPageUri: string
): string {
    const otherPages = pages
        .map((uri, idx) => ({ uri, idx }))
        .filter(({ uri }) => uri !== currentPageUri);

    if (otherPages.length === 0) return '';

    return otherPages
        .map(({ uri, idx }) => {
            const text = ocrText[uri];
            if (!text) return `Page ${idx + 1}: (not scanned yet)`;
            const preview = text.slice(0, 150).replace(/\n/g, ' ');
            return `Page ${idx + 1}: ${preview}${text.length > 150 ? '...' : ''}`;
        })
        .join('\n');
}