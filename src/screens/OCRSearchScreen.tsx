import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TextInput,
    TouchableOpacity, ScrollView, StatusBar,
    Animated, Keyboard, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, radius } from '../theme/theme';
import { useFolderStore } from '../store/folderStore';
import { RootStackParamList } from '../navigation/AppNavigator';
import { folderPalette } from '../theme/theme';

type Nav = StackNavigationProp<RootStackParamList>;

interface SearchResult {
    folderId: string;
    folderName: string;
    paletteIndex: number;
    pageIndex: number;
    pageUri: string;
    snippet: string;
}
function buildSnippet(text: string, query: string): string {
    if (!query.trim()) return text.slice(0, 120);

    const lower = text.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());

    if (idx === -1) return text.slice(0, 120);

    // Center window around the match
    const WINDOW = 60; // characters on each side of the match
    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(text.length, idx + query.length + WINDOW);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < text.length ? '...' : '';

    return `${prefix}${text.slice(start, end)}${suffix}`;
}

function highlight(text: string, query: string): React.ReactNode {
    const snippet = buildSnippet(text, query);

    if (!query.trim()) {
        return <Text style={styles.snippet}>{snippet}</Text>;
    }

    const lower = snippet.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());

    if (idx === -1) {
        return <Text style={styles.snippet}>{snippet}</Text>;
    }

    return (
        <Text style={styles.snippet}>
            {snippet.slice(0, idx)}
            <Text style={styles.snippetHighlight}>
                {snippet.slice(idx, idx + query.length)}
            </Text>
            {snippet.slice(idx + query.length)}
        </Text>
    );
}

export default function OCRSearchScreen() {
    const navigation = useNavigation<Nav>();
    const { folders } = useFolderStore();

    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [searched, setSearched] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string>('All');

    const inputRef = useRef<TextInput>(null);
    const resultsAnim = useRef(new Animated.Value(0)).current;

    function runSearch(text: string) {
        setQuery(text);
        if (!text.trim()) {
            setResults([]);
            setSearched(false);
            return;
        }

        const q = text.toLowerCase();
        const found: SearchResult[] = [];

        folders.forEach(folder => {
            // Use real OCR text stored per URI
            folder.pages.forEach((pageUri, pageIndex) => {
                const pageText = folder.ocrText?.[pageUri] ?? '';
                if (!pageText) return;

                if (pageText.toLowerCase().includes(q)) {
                    found.push({
                        folderId: folder.id,
                        folderName: folder.name,
                        paletteIndex: folder.paletteIndex,
                        pageIndex,
                        pageUri,
                        snippet: pageText,
                    });
                }
            });
        });

        setResults(found);
        setSearched(true);
        setActiveFilter('All');

        Animated.spring(resultsAnim, {
            toValue: 1,
            tension: 60,
            friction: 8,
            useNativeDriver: true,
        }).start();
    }

    // Filter chips — unique folder names from results
    const filterOptions = [
        'All',
        ...Array.from(new Set(results.map(r => r.folderName))),
    ];

    const filtered = activeFilter === 'All'
        ? results
        : results.filter(r => r.folderName === activeFilter);

    function clearSearch() {
        setQuery('');
        setResults([]);
        setSearched(false);
        setActiveFilter('All');
        inputRef.current?.focus();
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content"
                       backgroundColor={colors.bgSecondary} />

            {/* Top Bar */}
            <View style={styles.topBar}>
                <View style={styles.topRow}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.topTitle}>Search Notes</Text>
                </View>

                {/* Search input */}
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                        ref={inputRef}
                        style={styles.searchInput}
                        placeholder="Search inside your notes..."
                        placeholderTextColor={colors.textMuted}
                        value={query}
                        onChangeText={runSearch}
                        autoFocus
                        returnKeyType="search"
                        onSubmitEditing={Keyboard.dismiss}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={clearSearch}
                                          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                            <Text style={styles.clearBtn}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter chips */}
                {results.length > 0 && (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterRow}
                    >
                        {filterOptions.map(opt => (
                            <TouchableOpacity
                                key={opt}
                                style={[
                                    styles.filterChip,
                                    activeFilter === opt && styles.filterChipActive,
                                ]}
                                onPress={() => setActiveFilter(opt)}
                            >
                                <Text style={[
                                    styles.filterChipText,
                                    activeFilter === opt && styles.filterChipTextActive,
                                ]}>
                                    {opt}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </View>

            {/* Results */}
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.resultsList}
                showsVerticalScrollIndicator={false}
            >
                {/* Empty / idle state */}
                {!searched && query.length === 0 && (
                    <View style={styles.idleState}>
                        <Text style={styles.idleEmoji}>🔎</Text>
                        <Text style={styles.idleTitle}>Search your notes</Text>
                        <Text style={styles.idleSub}>
                            Type a word or topic and NoteVibe will
                            find it across all your subjects
                        </Text>
                        {/* Recent searches hint */}
                        <View style={styles.hintRow}>
                            <Text style={styles.hintLabel}>Try searching:</Text>
                        </View>
                        {['definition', 'formula', 'theorem', 'equation', 'example'].map(s => (
                            <TouchableOpacity
                                key={s}
                                style={styles.suggestionPill}
                                onPress={() => runSearch(s)}
                            >
                                <Text style={styles.suggestionText}>🔹 {s}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* No results */}
                {searched && filtered.length === 0 && (
                    <View style={styles.idleState}>
                        <Text style={styles.idleEmoji}>😕</Text>
                        <Text style={styles.idleTitle}>Nothing found</Text>
                        <Text style={styles.idleSub}>
                            No notes matched "{query}".{'\n'}
                            Try a different word or add more pages!
                        </Text>
                    </View>
                )}

                {/* Result count */}
                {searched && filtered.length > 0 && (
                    <Animated.View
                        style={[
                            styles.resultsHeader,
                            {
                                opacity: resultsAnim,
                                transform: [{
                                    translateY: resultsAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [10, 0],
                                    }),
                                }],
                            },
                        ]}
                    >
                        <Text style={styles.resultsCount}>
                            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                            {activeFilter !== 'All' ? ` in ${activeFilter}` : ''}
                        </Text>
                    </Animated.View>
                )}

                {/* Result cards */}
                {filtered.map((result, i) => {
                    const palette = folderPalette[result.paletteIndex];
                    return (
                        <Animated.View
                            key={`${result.folderId}-${result.pageIndex}`}
                            style={{
                                opacity: resultsAnim,
                                transform: [{
                                    translateY: resultsAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [20 + i * 5, 0],
                                    }),
                                }],
                            }}
                        >
                            <TouchableOpacity
                                style={styles.resultCard}
                                activeOpacity={0.8}
                                onPress={() => {
                                    navigation.navigate('StudyMode', {
                                        folderId: result.folderId,
                                        folderName: result.folderName,
                                    });
                                }}
                            >
                                {/* Folder color strip */}
                                <View style={[styles.colorStrip,
                                    { backgroundColor: palette.tab }]} />

                                {/* Thumbnail or placeholder */}
                                <View style={[styles.thumbBox,
                                    { backgroundColor: palette.bg }]}>
                                    {result.pageUri ? (
                                        <Image
                                            source={{ uri: result.pageUri }}
                                            style={styles.thumbImg}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <Text style={styles.thumbPlaceholder}>📄</Text>
                                    )}
                                </View>

                                {/* Info */}
                                <View style={styles.resultInfo}>
                                    <Text style={styles.resultFolder}
                                          numberOfLines={1}>
                                        {result.folderName}
                                    </Text>
                                    <Text style={styles.resultPage}>
                                        Page {result.pageIndex + 1}
                                    </Text>
                                    <View style={styles.snippetWrap}>
                                        {highlight(result.snippet, query)}
                                    </View>
                                </View>

                                <Text style={styles.resultArrow}>›</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    );
                })}

                <View style={{ height: 40 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container:          { flex: 1, backgroundColor: colors.bgPrimary },

    // Top bar
    topBar:             { backgroundColor: colors.bgSecondary,
        borderBottomWidth: 2,
        borderBottomColor: colors.border,
        paddingBottom: spacing.sm },
    topRow:             { flexDirection: 'row', alignItems: 'center',
        gap: 10, paddingHorizontal: spacing.lg,
        paddingTop: 52, paddingBottom: spacing.sm },
    backBtn:            { width: 36, height: 36,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md, borderWidth: 2,
        borderColor: colors.borderSoft,
        alignItems: 'center', justifyContent: 'center' },
    backBtnText:        { fontSize: 18, color: colors.yellow,
        fontWeight: '700' },
    topTitle:           { fontSize: 20, fontWeight: '800',
        color: colors.textPrimary, flex: 1 },

    // Search bar
    searchBar:          { flexDirection: 'row', alignItems: 'center',
        gap: 8, marginHorizontal: spacing.lg,
        backgroundColor: colors.bgPrimary,
        borderWidth: 2.5, borderColor: colors.borderSoft,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm },
    searchIcon:         { fontSize: 15 },
    searchInput:        { flex: 1, fontSize: 14, fontWeight: '700',
        color: colors.textPrimary },
    clearBtn:           { fontSize: 13, color: colors.textMuted,
        fontWeight: '700' },

    // Filter chips
    filterRow:          { paddingHorizontal: spacing.lg,
        gap: 8, paddingBottom: 2 },
    filterChip:         { paddingHorizontal: 14, paddingVertical: 5,
        borderRadius: radius.full, borderWidth: 2,
        borderColor: colors.borderSoft },
    filterChipActive:   { backgroundColor: colors.purple,
        borderColor: colors.purple },
    filterChipText:     { fontSize: 12, fontWeight: '700',
        color: colors.textMuted },
    filterChipTextActive: { color: '#fff' },

    // Results list
    resultsList:        { padding: spacing.lg, paddingTop: spacing.md },

    resultsHeader:      { marginBottom: spacing.sm },
    resultsCount:       { fontSize: 12, fontWeight: '800',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8 },

    // Result card
    resultCard:         { flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.border,
        marginBottom: spacing.sm,
        overflow: 'hidden' },
    colorStrip:         { width: 5, alignSelf: 'stretch' },
    thumbBox:           { width: 52, height: 64,
        alignItems: 'center',
        justifyContent: 'center',
        margin: spacing.sm,
        borderRadius: radius.sm,
        overflow: 'hidden' },
    thumbImg:           { width: '100%', height: '100%' },
    thumbPlaceholder:   { fontSize: 22 },
    resultInfo:         { flex: 1, paddingVertical: spacing.sm,
        paddingRight: spacing.sm },
    resultFolder:       { fontSize: 13, fontWeight: '800',
        color: colors.textPrimary, marginBottom: 2 },
    resultPage:         { fontSize: 10, fontWeight: '700',
        color: colors.textMuted, marginBottom: 4 },
    snippetWrap:        { flexDirection: 'row', flexWrap: 'wrap' },
    snippet:            { fontSize: 11, color: colors.textMuted,
        fontWeight: '600', lineHeight: 16 },
    snippetHighlight:   { color: colors.yellow, fontWeight: '800' },
    resultArrow:        { fontSize: 20, color: colors.textMuted,
        paddingRight: spacing.sm },

    // Idle / empty state
    idleState:          { alignItems: 'center', paddingTop: 60,
        paddingHorizontal: 32 },
    idleEmoji:          { fontSize: 52, marginBottom: 12 },
    idleTitle:          { fontSize: 22, fontWeight: '800',
        color: colors.textPrimary, marginBottom: 8 },
    idleSub:            { fontSize: 14, color: colors.textMuted,
        fontWeight: '600', textAlign: 'center',
        lineHeight: 22, marginBottom: 28 },
    hintRow:            { marginBottom: 12 },
    hintLabel:          { fontSize: 12, fontWeight: '800',
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.8 },
    suggestionPill:     { backgroundColor: colors.bgCard,
        borderRadius: radius.full, borderWidth: 2,
        borderColor: colors.borderSoft,
        paddingHorizontal: 18, paddingVertical: 8,
        marginBottom: 8, width: '100%',
        alignItems: 'center' },
    suggestionText:     { fontSize: 14, fontWeight: '700',
        color: colors.textPrimary },
});