import React, { useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    Animated, StatusBar, Dimensions,
} from 'react-native';
import { colors, spacing, radius, folderPalette } from '../theme/theme';
import { useFolderStore } from '../store/folderStore';
import { useStatsStore } from '../store/statsStore';

const { width: W } = Dimensions.get('window');

type Mood = 'happy' | 'sleepy' | 'grumpy';

function getMood(streak: number, lastOpenedAgo: number): Mood {
    if (lastOpenedAgo > 24 * 60 * 60 * 1000) return 'sleepy';
    if (streak < 2) return 'grumpy';
    return 'happy';
}

function formatTime(seconds: number): string {
    if (seconds === 0) return '—';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getLast7Days() {
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
            date: d.toISOString().slice(0, 10),
            label: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()],
            isToday: i === 6,
        };
    });
}

// ── Animated bar ─────────────────────────────────────────────
function Bar({
                 value, max, color, delay, isEmpty,
             }: {
    value: number; max: number; color: string;
    delay: number; isEmpty: boolean;
}) {
    const anim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        if (isEmpty) return;
        Animated.timing(anim, {
            toValue: max > 0 ? value / max : 0,
            duration: 600, delay,
            useNativeDriver: false,
        }).start();
    }, [value, max]);

    if (isEmpty) {
        return (
            <View style={[styles.barTrack,
                { justifyContent: 'center', alignItems: 'center' }]}>
                <View style={styles.emptyBarLine} />
            </View>
        );
    }

    return (
        <View style={styles.barTrack}>
            <Animated.View style={{
                position: 'absolute', bottom: 0,
                width: '100%', borderRadius: 6,
                backgroundColor: color,
                height: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                }),
            }} />
        </View>
    );
}

// ── Cat ───────────────────────────────────────────────────────
function CatFace({ mood }: { mood: Mood }) {
    const bounceAnim = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(bounceAnim, {
                    toValue: -8, duration: 900, useNativeDriver: true,
                }),
                Animated.timing(bounceAnim, {
                    toValue: 0, duration: 900, useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const cfg = {
        happy: {
            badge: '😊 Happy & Focused!',
            badgeColor: '#4ADE80', badgeBg: '#14532D',
            bubble: 'Great study session!\nKeep it up! 💪',
            mouthChar: '◡',
        },
        sleepy: {
            badge: '😴 Feeling Sleepy...',
            badgeColor: '#93C5FD', badgeBg: '#1E3A5F',
            bubble: "Haven't seen you in a while...\nCome study with me! 💤",
            mouthChar: '‿',
        },
        grumpy: {
            badge: '😤 Start Your Streak!',
            badgeColor: '#FCA5A5', badgeBg: '#450A0A',
            bubble: "No streak yet!\nLet's build one today! 🔥",
            mouthChar: '︵',
        },
    }[mood];

    return (
        <Animated.View style={[styles.catWrap,
            { transform: [{ translateY: bounceAnim }] }]}>
            <View style={[styles.moodBadge,
                { backgroundColor: cfg.badgeBg }]}>
                <Text style={[styles.moodBadgeText,
                    { color: cfg.badgeColor }]}>{cfg.badge}</Text>
            </View>
            <View style={styles.catBody}>
                <View style={styles.earsRow}>
                    <View style={styles.ear}>
                        <View style={styles.earInner} />
                    </View>
                    <View style={[styles.ear, styles.earRight]}>
                        <View style={styles.earInner} />
                    </View>
                </View>
                <View style={styles.catHead}>
                    <View style={styles.capBrim} />
                    <View style={styles.capTop} />
                    <View style={styles.eyesRow}>
                        <View style={[styles.eye,
                            mood === 'sleepy' && styles.eyeSleepy,
                            mood === 'grumpy' && styles.eyeGrouchy]}>
                            {mood === 'happy' && <View style={styles.eyePupil} />}
                        </View>
                        <View style={[styles.eye,
                            mood === 'sleepy' && styles.eyeSleepy,
                            mood === 'grumpy' && styles.eyeGrouchy]}>
                            {mood === 'happy' && <View style={styles.eyePupil} />}
                        </View>
                    </View>
                    <View style={styles.nose} />
                    <Text style={[styles.mouthText,
                        mood === 'grumpy' && { color: '#FCA5A5' }]}>
                        {cfg.mouthChar}
                    </Text>
                    <View style={styles.whiskersLeft}>
                        <View style={styles.whisker} />
                        <View style={styles.whisker} />
                    </View>
                    <View style={styles.whiskersRight}>
                        <View style={styles.whisker} />
                        <View style={styles.whisker} />
                    </View>
                    {mood === 'happy' && (
                        <>
                            <View style={[styles.cheek, styles.cheekLeft]} />
                            <View style={[styles.cheek, styles.cheekRight]} />
                        </>
                    )}
                </View>
                <View style={styles.tailWrap}>
                    <View style={styles.tail} />
                    <View style={styles.tailTip} />
                </View>
                <View style={styles.pawsRow}>
                    <View style={styles.paw} />
                    <View style={styles.paw} />
                </View>
            </View>
            <View style={styles.bubble}>
                <View style={styles.bubbleArrow} />
                <Text style={styles.bubbleText}>{cfg.bubble}</Text>
            </View>
        </Animated.View>
    );
}

// ── Main ──────────────────────────────────────────────────────
export default function PetStatsScreen() {
    const { folders } = useFolderStore();
    const { streak, weeklyData } = useStatsStore();

    const mostRecent = folders.length > 0
        ? Math.max(...folders.map(f => f.lastOpened))
        : Date.now();
    const mood = getMood(streak, Date.now() - mostRecent);

    const totalPages = folders.reduce((a, f) => a + f.pages.length, 0);
    const totalStudySecs = folders.reduce(
        (a, f) => a + (f.totalStudySeconds ?? 0), 0
    );

    // XP from real data only
    const totalXP = totalPages * 10 + streak * 20;
    const xpLevel = Math.floor(totalXP / 200) + 1;
    const xpInLevel = totalXP % 200;
    const xpAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(xpAnim, {
            toValue: totalXP === 0 ? 0 : xpInLevel / 200,
            duration: 900, delay: 300,
            useNativeDriver: false,
        }).start();
    }, [xpInLevel]);

    // Build last 7 days from real tracked data only
    const last7 = getLast7Days();
    const chartData = last7.map(day => {
        const record = weeklyData.find(r => r.date === day.date);
        const seconds = record?.seconds ?? 0;
        return {
            label: day.label,
            isToday: day.isToday,
            seconds,
            minutes: Math.floor(seconds / 60),
            isEmpty: !record,
        };
    });

    const maxMins = Math.max(
        ...chartData.filter(d => !d.isEmpty).map(d => d.minutes),
        1
    );

    // Per subject real study time
    const maxSecs = Math.max(
        ...folders.map(f => f.totalStudySeconds ?? 0), 1
    );

    const hasAnyData = totalStudySecs > 0 || totalPages > 0;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content"
                       backgroundColor={colors.bgPrimary} />
            <ScrollView showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scroll}>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Study Buddy</Text>
                    <View style={styles.streakBadge}>
                        <Text style={styles.streakFire}>🔥</Text>
                        <View>
                            <Text style={styles.streakNum}>{streak}</Text>
                            <Text style={styles.streakLabel}>Day Streak</Text>
                        </View>
                    </View>
                </View>

                <CatFace mood={mood} />

                {/* No data yet state */}
                {!hasAnyData && (
                    <View style={styles.noDataCard}>
                        <Text style={styles.noDataEmoji}>📊</Text>
                        <Text style={styles.noDataTitle}>
                            No stats yet!
                        </Text>
                        <Text style={styles.noDataSub}>
                            Open a subject folder and start studying.
                            Your real data will appear here as you go.
                        </Text>
                    </View>
                )}

                {/* XP Bar — only show if they have done something */}
                {hasAnyData && (
                    <View style={styles.xpCard}>
                        <Text style={styles.xpIcon}>⚡</Text>
                        <View style={styles.xpInfo}>
                            <View style={styles.xpTopRow}>
                                <Text style={styles.xpLabel}>
                                    Level {xpLevel} Scholar
                                </Text>
                                <Text style={styles.xpVal}>
                                    {xpInLevel} / 200 XP
                                </Text>
                            </View>
                            <View style={styles.xpTrack}>
                                <Animated.View style={[styles.xpFill, {
                                    width: xpAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                    }),
                                }]} />
                            </View>
                        </View>
                    </View>
                )}

                {/* Weekly chart — always show, empty bars for days with no data */}
                <View style={styles.sectionCard}>
                    <View style={styles.sectionHeaderRow}>
                        <Text style={styles.sectionTitle}>This Week</Text>
                        {!hasAnyData && (
                            <Text style={styles.sectionHint}>
                                Study to fill these in!
                            </Text>
                        )}
                    </View>
                    <View style={styles.barChart}>
                        {chartData.map((d, i) => (
                            <View key={d.label} style={styles.barCol}>
                                <Bar
                                    value={d.minutes}
                                    max={maxMins}
                                    color={d.isToday ? colors.yellow : colors.purple}
                                    delay={i * 60}
                                    isEmpty={d.isEmpty}
                                />
                                <Text style={[
                                    styles.barLabel,
                                    d.isToday && { color: colors.yellow },
                                ]}>
                                    {d.label}
                                </Text>
                                <Text style={styles.barMin}>
                                    {d.isEmpty ? '' : d.minutes > 0
                                        ? `${d.minutes}m` : '0m'}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Per subject breakdown — only if real data exists */}
                {folders.some(f => (f.totalStudySeconds ?? 0) > 0) && (
                    <View style={styles.sectionCard}>
                        <Text style={styles.sectionTitle}>By Subject</Text>
                        {folders
                            .filter(f => (f.totalStudySeconds ?? 0) > 0)
                            .sort((a, b) =>
                                (b.totalStudySeconds ?? 0) - (a.totalStudySeconds ?? 0)
                            )
                            .map(f => {
                                const palette = folderPalette[f.paletteIndex];
                                const secs = f.totalStudySeconds ?? 0;
                                return (
                                    <View key={f.id} style={styles.subjectRow}>
                                        <View style={[styles.subjectDot,
                                            { backgroundColor: palette.tab }]} />
                                        <Text style={styles.subjectName}
                                              numberOfLines={1}>
                                            {f.name}
                                        </Text>
                                        <View style={styles.subjectTrack}>
                                            <View style={[styles.subjectFill, {
                                                backgroundColor: palette.tab,
                                                width: `${(secs / maxSecs) * 100}%`,
                                            }]} />
                                        </View>
                                        <Text style={styles.subjectTime}>
                                            {formatTime(secs)}
                                        </Text>
                                    </View>
                                );
                            })}
                    </View>
                )}

                {/* Stats grid — zeros shown as dashes until earned */}
                {hasAnyData && (
                    <View style={styles.statsGrid}>
                        <View style={styles.statCard}>
                            <Text style={styles.statEmoji}>📚</Text>
                            <Text style={styles.statVal}>{folders.length}</Text>
                            <Text style={styles.statLabel}>Subjects</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statEmoji}>📄</Text>
                            <Text style={styles.statVal}>{totalPages}</Text>
                            <Text style={styles.statLabel}>Total Pages</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statEmoji}>⏱️</Text>
                            <Text style={styles.statVal}>
                                {formatTime(totalStudySecs)}
                            </Text>
                            <Text style={styles.statLabel}>Study Time</Text>
                        </View>
                        <View style={styles.statCard}>
                            <Text style={styles.statEmoji}>🔥</Text>
                            <Text style={styles.statVal}>{streak}</Text>
                            <Text style={styles.statLabel}>Day Streak</Text>
                        </View>
                    </View>
                )}

                <View style={{ height: 30 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container:        { flex: 1, backgroundColor: colors.bgPrimary },
    scroll:           { paddingBottom: 20 },
    header:           { flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: 52, paddingBottom: spacing.md },
    headerTitle:      { fontSize: 26, fontWeight: '800',
        color: colors.yellow },
    streakBadge:      { flexDirection: 'row', alignItems: 'center',
        gap: 6, backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.streakBorder,
        paddingHorizontal: 12, paddingVertical: 6 },
    streakFire:       { fontSize: 20 },
    streakNum:        { fontSize: 18, fontWeight: '800',
        color: colors.streak, lineHeight: 20 },
    streakLabel:      { fontSize: 10, fontWeight: '700',
        color: colors.streak },
    catWrap:          { alignItems: 'center',
        paddingVertical: spacing.md },
    moodBadge:        { borderRadius: radius.full,
        paddingHorizontal: 16, paddingVertical: 5,
        marginBottom: 10, borderWidth: 2,
        borderColor: 'rgba(0,0,0,0.3)' },
    moodBadgeText:    { fontSize: 13, fontWeight: '800' },
    catBody:          { alignItems: 'center', position: 'relative' },
    earsRow:          { flexDirection: 'row',
        justifyContent: 'space-between',
        width: 110, marginBottom: -10, zIndex: 1 },
    ear:              { width: 28, height: 34,
        backgroundColor: '#9D7CFF',
        borderTopLeftRadius: 14,
        borderTopRightRadius: 4,
        borderWidth: 2.5, borderColor: '#1C1B2E',
        alignItems: 'center',
        justifyContent: 'flex-end', paddingBottom: 4 },
    earRight:         { borderTopLeftRadius: 4,
        borderTopRightRadius: 14 },
    earInner:         { width: 12, height: 16,
        backgroundColor: '#FF9EFF', borderRadius: 6 },
    catHead:          { width: 120, height: 110,
        backgroundColor: '#9D7CFF', borderRadius: 55,
        borderWidth: 2.5, borderColor: '#1C1B2E',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative', overflow: 'hidden' },
    capBrim:          { position: 'absolute', top: 8, width: 90,
        height: 8, backgroundColor: colors.yellow,
        borderRadius: 4, borderWidth: 2,
        borderColor: '#000' },
    capTop:           { position: 'absolute', top: 0, width: 50,
        height: 18, backgroundColor: colors.yellow,
        borderRadius: 4, borderWidth: 2,
        borderColor: '#000' },
    eyesRow:          { flexDirection: 'row', gap: 20, marginTop: 12 },
    eye:              { width: 20, height: 22,
        backgroundColor: '#1C1B2E', borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'flex-start', paddingTop: 3 },
    eyeSleepy:        { height: 10, borderRadius: 5 },
    eyeGrouchy:       { transform: [{ rotate: '15deg' }] },
    eyePupil:         { width: 6, height: 6, backgroundColor: '#fff',
        borderRadius: 3 },
    nose:             { width: 8, height: 6,
        backgroundColor: '#FF9EFF',
        borderRadius: 4, marginTop: 6 },
    mouthText:        { fontSize: 16, color: '#1C1B2E',
        fontWeight: '800', marginTop: 2 },
    whiskersLeft:     { position: 'absolute', left: 4,
        top: 62, gap: 5 },
    whiskersRight:    { position: 'absolute', right: 4,
        top: 62, gap: 5 },
    whisker:          { width: 24, height: 2,
        backgroundColor: '#1C1B2E', borderRadius: 1 },
    cheek:            { position: 'absolute', width: 18, height: 10,
        backgroundColor: 'rgba(255,160,255,0.5)',
        borderRadius: 9, top: 70 },
    cheekLeft:        { left: 8 },
    cheekRight:       { right: 8 },
    tailWrap:         { position: 'absolute', right: -30,
        bottom: 10, alignItems: 'flex-end' },
    tail:             { width: 8, height: 50,
        backgroundColor: '#9D7CFF', borderRadius: 4,
        borderWidth: 2, borderColor: '#1C1B2E',
        transform: [{ rotate: '20deg' }] },
    tailTip:          { width: 14, height: 14,
        backgroundColor: '#C0A0FF', borderRadius: 7,
        borderWidth: 2, borderColor: '#1C1B2E',
        marginTop: -4 },
    pawsRow:          { flexDirection: 'row', gap: 24, marginTop: 6 },
    paw:              { width: 28, height: 16,
        backgroundColor: '#9D7CFF', borderRadius: 12,
        borderWidth: 2, borderColor: '#1C1B2E' },
    bubble:           { backgroundColor: colors.bgCard, borderWidth: 2,
        borderColor: colors.borderSoft,
        borderRadius: radius.lg, padding: 10,
        marginTop: 10, maxWidth: 220,
        position: 'relative' },
    bubbleArrow:      { position: 'absolute', top: -8, left: '50%',
        width: 12, height: 12,
        backgroundColor: colors.bgCard,
        borderLeftWidth: 2, borderTopWidth: 2,
        borderColor: colors.borderSoft,
        transform: [{ rotate: '45deg' },
            { translateX: -6 }] },
    bubbleText:       { fontSize: 12, color: colors.purpleSoft,
        fontWeight: '700', textAlign: 'center',
        lineHeight: 18 },
    noDataCard:       { marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.borderDim,
        borderStyle: 'dashed',
        padding: spacing.lg, alignItems: 'center' },
    noDataEmoji:      { fontSize: 32, marginBottom: 8 },
    noDataTitle:      { fontSize: 16, fontWeight: '800',
        color: colors.textPrimary, marginBottom: 4 },
    noDataSub:        { fontSize: 12, color: colors.textMuted,
        fontWeight: '600', textAlign: 'center',
        lineHeight: 18 },
    xpCard:           { flexDirection: 'row', alignItems: 'center',
        gap: 12, marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.border,
        padding: spacing.md },
    xpIcon:           { fontSize: 24 },
    xpInfo:           { flex: 1 },
    xpTopRow:         { flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6 },
    xpLabel:          { fontSize: 12, fontWeight: '700',
        color: colors.textMuted },
    xpVal:            { fontSize: 12, fontWeight: '800',
        color: colors.yellow },
    xpTrack:          { height: 10,
        backgroundColor: colors.bgPrimary,
        borderRadius: 5, overflow: 'hidden' },
    xpFill:           { height: '100%',
        backgroundColor: colors.yellow,
        borderRadius: 5 },
    sectionCard:      { marginHorizontal: spacing.lg,
        marginBottom: spacing.md,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.border,
        padding: spacing.md },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md },
    sectionTitle:     { fontSize: 15, fontWeight: '800',
        color: colors.textPrimary },
    sectionHint:      { fontSize: 11, fontWeight: '600',
        color: colors.textMuted },
    barChart:         { flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end', height: 90 },
    barCol:           { alignItems: 'center', flex: 1, gap: 4 },
    barTrack:         { width: '60%', height: 60,
        backgroundColor: colors.bgSecondary,
        borderRadius: 6, overflow: 'hidden',
        position: 'relative' },
    emptyBarLine:     { width: '60%', height: 2,
        backgroundColor: colors.borderSoft,
        borderRadius: 1 },
    barLabel:         { fontSize: 10, fontWeight: '700',
        color: colors.textMuted },
    barMin:           { fontSize: 9, fontWeight: '600',
        color: colors.textMuted, minHeight: 12 },
    subjectRow:       { flexDirection: 'row', alignItems: 'center',
        gap: 8, marginBottom: 10 },
    subjectDot:       { width: 10, height: 10, borderRadius: 5,
        flexShrink: 0 },
    subjectName:      { fontSize: 11, fontWeight: '700',
        color: colors.textMuted, width: 68 },
    subjectTrack:     { flex: 1, height: 14,
        backgroundColor: colors.bgSecondary,
        borderRadius: 7, overflow: 'hidden' },
    subjectFill:      { height: '100%', borderRadius: 7 },
    subjectTime:      { fontSize: 11, fontWeight: '700',
        color: colors.textMuted, width: 40,
        textAlign: 'right' },
    statsGrid:        { flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: spacing.lg, gap: 10 },
    statCard:         { width: (W - spacing.lg * 2 - 10) / 2,
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.border, padding: spacing.md,
        alignItems: 'center', gap: 4 },
    statEmoji:        { fontSize: 24 },
    statVal:          { fontSize: 22, fontWeight: '800',
        color: colors.textPrimary },
    statLabel:        { fontSize: 11, fontWeight: '700',
        color: colors.textMuted },
});