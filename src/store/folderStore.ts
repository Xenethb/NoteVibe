import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
}

export interface Folder {
    id: string;
    name: string;
    paletteIndex: number;
    pages: string[];
    lastOpened: number;
    totalStudySeconds: number;
    ocrText: Record<string, string>;
    chatHistory: ChatMessage[];
}

interface FolderStore {
    folders: Folder[];
    hydrated: boolean;
    hydrate: () => Promise<void>;
    addFolder: (name: string, paletteIndex: number) => string;
    deleteFolder: (id: string) => void;
    renameFolder: (id: string, name: string) => void;
    addPages: (id: string, uris: string[]) => void;
    removePage: (id: string, pageIndex: number) => void;
    reorderPages: (id: string, pages: string[]) => void;
    touchFolder: (id: string) => void;
    addStudyTime: (id: string, seconds: number) => void;
    saveOcrText: (id: string, uri: string, text: string) => void;
    saveChatHistory: (id: string, messages: ChatMessage[]) => void;
    getAllOcrText: (id: string) => string;
}

const STORAGE_KEY = 'notevibe_folders';

async function persist(folders: Folder[]) {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
    } catch (e) {
        console.warn('Failed to save folders', e);
    }
}

export const useFolderStore = create<FolderStore>((set, get) => ({
    folders: [],
    hydrated: false,

    hydrate: async () => {
        try {
            const raw = await AsyncStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw) as Folder[];
                const migrated = parsed.map(f => ({
                    ...f,
                    ocrText: f.ocrText ?? {},
                    totalStudySeconds: f.totalStudySeconds ?? 0,
                    chatHistory: f.chatHistory ?? [],
                }));
                set({ folders: migrated, hydrated: true });
            } else {
                const seed: Folder[] = [{
                    id: '1', name: 'Welcome Notes', paletteIndex: 0,
                    pages: [], lastOpened: Date.now(), totalStudySeconds: 0,
                    ocrText: {}, chatHistory: [],
                }];
                set({ folders: seed, hydrated: true });
                await persist(seed);
            }
        } catch {
            set({ hydrated: true });
        }
    },

    addFolder: (name, paletteIndex) => {
        const id = Date.now().toString();
        const newFolder: Folder = {
            id, name, paletteIndex, pages: [],
            lastOpened: Date.now(), totalStudySeconds: 0,
            ocrText: {}, chatHistory: [],
        };
        const updated = [newFolder, ...get().folders];
        set({ folders: updated });
        persist(updated);
        return id;
    },

    deleteFolder: (id) => {
        const updated = get().folders.filter(f => f.id !== id);
        set({ folders: updated });
        persist(updated);
    },

    renameFolder: (id, name) => {
        const updated = get().folders.map(f => f.id === id ? { ...f, name } : f);
        set({ folders: updated });
        persist(updated);
    },

    addPages: (id, uris) => {
        const updated = get().folders.map(f =>
            f.id === id ? { ...f, pages: [...f.pages, ...uris], lastOpened: Date.now() } : f
        );
        set({ folders: updated });
        persist(updated);
    },

    removePage: (id, pageIndex) => {
        const updated = get().folders.map(f => {
            if (f.id !== id) return f;

            // 1. Find the URI of the page we are about to delete
            const uriToDelete = f.pages[pageIndex];

            // 2. Clone the OCR object and remove that specific URI
            const newOcr = { ...f.ocrText };
            if (uriToDelete) {
                delete newOcr[uriToDelete];
            }

            return {
                ...f,
                pages: f.pages.filter((_, i) => i !== pageIndex),
                ocrText: newOcr,
            };
        });
        set({ folders: updated });
        persist(updated);
    },

    reorderPages: (id, pages) => {
        const updated = get().folders.map(f => f.id === id ? { ...f, pages } : f);
        set({ folders: updated });
        persist(updated);
    },

    touchFolder: (id) => {
        const updated = get().folders.map(f => f.id === id ? { ...f, lastOpened: Date.now() } : f);
        set({ folders: updated });
        persist(updated);
    },

    addStudyTime: (id, seconds) => {
        const updated = get().folders.map(f =>
            f.id === id ? { ...f, totalStudySeconds: f.totalStudySeconds + seconds } : f
        );
        set({ folders: updated });
        persist(updated);
    },

    saveOcrText: (id, uri, text) => {
        const updated = get().folders.map(f =>
            f.id === id ? { ...f, ocrText: { ...f.ocrText, [uri]: text } } : f
        );
        set({ folders: updated });
        persist(updated);
    },

    saveChatHistory: (id, messages) => {
        const updated = get().folders.map(f => f.id === id ? { ...f, chatHistory: messages } : f);
        set({ folders: updated });
        persist(updated);
    },

    getAllOcrText: (id) => {
        const folder = get().folders.find(f => f.id === id);
        if (!folder) return '';
        return folder.pages
            .map((uri, idx) => {
                const text = folder.ocrText[uri];
                if (!text) return `[Page ${idx + 1}]\n(Scanning in progress...)`;
                return `[Page ${idx + 1}]\n${text}`;
            })
            .join('\n\n');
    },
}));