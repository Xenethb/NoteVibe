import TextRecognition from '@react-native-ml-kit/text-recognition';

export async function extractTextFromImage(imageUri: string): Promise<string> {
    console.log("🟡 [OCR CHECK] Starting scan for URI:", imageUri);
    try {
        const result = await TextRecognition.recognize(imageUri);
        const text = result.blocks.map(block => block.text).join('\n');
        console.log("🟢 [OCR CHECK] Found text length:", text.length);
        return text;
    } catch (e) {
        console.error("🔴 [OCR CHECK] ML KIT CRASHED:", e);
        return '';
    }
}

export async function extractTextFromPages(uris: string[]): Promise<Record<string, string>> {
    console.log("🔵 [OCR CHECK] helper received", uris.length, "uris");
    const results: Record<string, string> = {};
    for (const uri of uris) {
        const text = await extractTextFromImage(uri);
        if (text.trim().length > 0) {
            results[uri] = text;
        }
    }
    return results;
}