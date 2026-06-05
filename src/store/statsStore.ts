import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface DayRecord {
    date: string;       // "2026-04-25"
    seconds: number;
}

interface StatsStore {
    streak: number;
    lastStudyDate: string | null;
    weeklyData: DayRecord[];
    hydrated: boolean;
    hydrate: () => Promise<void>;
    recordSession: () => void;
    addDayTime: (seconds: number) => void;
}

const STATS_KEY = 'notevibe_stats';

function todayStr() {
    return new Date().toISOString().slice(0, 10);
}

function yesterdayStr() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
}

function getLast7Days(): string[] {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().slice(0, 10);
    });
}

async function save(data: object) {
    try {
        await AsyncStorage.setItem(STATS_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn('Failed to save stats', e);
    }
}

export const useStatsStore = create<StatsStore>((set, get) => ({
    streak: 0,
    lastStudyDate: null,
    weeklyData: [],
    hydrated: false,

    hydrate: async () => {
        try {
            const raw = await AsyncStorage.getItem(STATS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                const today = todayStr();
                const yesterday = yesterdayStr();
                let streak = parsed.streak ?? 0;

                // Reset streak if more than 1 day gap
                if (
                    parsed.lastStudyDate !== today &&
                    parsed.lastStudyDate !== yesterday
                ) {
                    streak = 0;
                }

                set({
                    streak,
                    lastStudyDate: parsed.lastStudyDate ?? null,
                    weeklyData: parsed.weeklyData ?? [],
                    hydrated: true,
                });
            } else {
                set({ hydrated: true });
            }
        } catch {
            set({ hydrated: true });
        }
    },

    recordSession: () => {
        const today = todayStr();
        const { lastStudyDate, streak } = get();
        let newStreak = streak;

        if (lastStudyDate === today) {
            return; // already recorded today
        } else if (lastStudyDate === yesterdayStr()) {
            newStreak = streak + 1;
        } else {
            newStreak = 1;
        }

        const updated = {
            streak: newStreak,
            lastStudyDate: today,
            weeklyData: get().weeklyData,
        };
        set({ streak: newStreak, lastStudyDate: today });
        save(updated);
    },

    addDayTime: (seconds: number) => {
        const today = todayStr();
        const existing = get().weeklyData;
        const idx = existing.findIndex(d => d.date === today);

        let updated: DayRecord[];
        if (idx >= 0) {
            updated = existing.map((d, i) =>
                i === idx ? { ...d, seconds: d.seconds + seconds } : d
            );
        } else {
            updated = [...existing, { date: today, seconds }];
        }

        // Keep only last 30 days to avoid bloat
        if (updated.length > 30) {
            updated = updated.slice(-30);
        }

        set({ weeklyData: updated });
        save({
            streak: get().streak,
            lastStudyDate: get().lastStudyDate,
            weeklyData: updated,
        });
    },
}));