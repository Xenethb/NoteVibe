import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    TextInput, ScrollView, KeyboardAvoidingView,
    Platform, Animated, StatusBar, ActivityIndicator,
    Keyboard,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFolderStore, ChatMessage } from '../store/folderStore';
import { askGemini, buildFolderSummary, GeminiMessage } from '../utils/geminiHelper';

type Nav = StackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'AICopilot'>;

interface UIMessage {
    id: string;
    role: 'user' | 'ai';
    text: string;
    loading?: boolean;
}

const QUICK_ACTIONS = [
    {
        label: '📋  Summarize this page',
        prompt: 'Please summarize the current page clearly in bullet points.',
    },
    {
        label: '🔑  Key points',
        prompt: 'What are the most important key points on this page I must remember?',
    },
    {
        label: '❓  Quiz me',
        prompt: 'Ask me 3 quiz questions based on this page to test my understanding.',
    },
    {
        label: '📖  Explain simply',
        prompt: 'What is the hardest concept on this page? Explain it simply.',
    },
    {
        label: '📝  Exam prep',
        prompt: 'What from this page should I focus on most for an exam?',
    },
    {
        label: '🔗  Connect to other pages',
        prompt: 'How does this page connect to the other pages in these notes?',
    },
];

function toGeminiHistory(messages: ChatMessage[]): GeminiMessage[] {
    return messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
    }));
}

export default function AICopilotScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const insets = useSafeAreaInsets();
    const {
        folderId,
        folderName,
        currentPageUri,
        currentPageIndex,
    } = route.params;

    const { folders, saveChatHistory } = useFolderStore();
    const folder = folders.find(f => f.id === folderId);

    const pageCount = folder?.pages.length ?? 0;
    const ocrMap = folder?.ocrText ?? {};
    const scannedCount = Object.keys(ocrMap).length;

    // Current page OCR — primary context
    const currentPageOcr = ocrMap[currentPageUri] ?? '';
    const hasCurrentPageOcr = currentPageOcr.trim().length > 0;

    // Other pages — secondary context (brief summaries only)
    const folderSummary = buildFolderSummary(
        folder?.pages ?? [],
        ocrMap,
        currentPageUri
    );

    const storedHistory = folder?.chatHistory ?? [];

    const buildInitialMessages = (): UIMessage[] => {
        if (storedHistory.length > 0) {
            return storedHistory.map(m => ({
                id: m.id,
                role: m.role,
                text: m.text,
            }));
        }
        return [{
            id: 'intro',
            role: 'ai',
            text: hasCurrentPageOcr
                ? `Hey! I'm looking at Page ${currentPageIndex + 1} of your ${folderName} notes. Ask me anything about it! ✦`
                : `Hey! Page ${currentPageIndex + 1} of ${folderName} hasn't been scanned yet. Add it through the Organizer to enable AI reading. I can still help with general questions! ✦`,
        }];
    };

    const [messages, setMessages] = useState<UIMessage[]>(buildInitialMessages);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const geminiHistory = useRef<GeminiMessage[]>(toGeminiHistory(storedHistory));
    const scrollRef = useRef<ScrollView>(null);
    const slideAnim = useRef(new Animated.Value(50)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.spring(slideAnim, {
                toValue: 0, tension: 60,
                friction: 10, useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1, duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    function scrollToBottom() {
        setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
        }, 150);
    }

    function persistMessages(newMessages: UIMessage[]) {
        const toSave: ChatMessage[] = newMessages
            .filter(m => !m.loading && m.id !== 'intro')
            .map(m => ({ id: m.id, role: m.role, text: m.text }));
        saveChatHistory(folderId, toSave);
    }

    async function sendMessage(text?: string) {
        const msg = (text ?? input).trim();
        if (!msg || isTyping) return;

        setInput('');
        Keyboard.dismiss();

        const userMsg: UIMessage = {
            id: Date.now().toString(),
            role: 'user',
            text: msg,
        };
        const loadingMsg: UIMessage = {
            id: 'loading',
            role: 'ai',
            text: '',
            loading: true,
        };

        const withUser = [...messages, userMsg, loadingMsg];
        setMessages(withUser);
        setIsTyping(true);
        scrollToBottom();

        try {
            const response = await askGemini(
                msg,
                folderName,
                currentPageOcr,       // primary — current page only
                currentPageIndex,
                pageCount,
                folderSummary,         // secondary — brief summaries of other pages
                geminiHistory.current
            );

            const aiMsg: UIMessage = {
                id: Date.now().toString() + '-ai',
                role: 'ai',
                text: response,
            };

            const finalMessages = [
                ...withUser.filter(m => m.id !== 'loading'),
                aiMsg,
            ];

            setMessages(finalMessages);

            geminiHistory.current = [
                ...geminiHistory.current,
                { role: 'user', parts: [{ text: msg }] },
                { role: 'model', parts: [{ text: response }] },
            ];

            if (geminiHistory.current.length > 20) {
                geminiHistory.current = geminiHistory.current.slice(-20);
            }

            persistMessages(finalMessages);

        } catch (err) {
            const code = err instanceof Error ? err.message : '';
            let errorText = "Sorry, I couldn't connect. Check your internet and try again!";
            if (code.includes('503') || code === 'SERVICE_OVERLOADED') {
                errorText = '🤖 Gemini is busy right now. Wait a few seconds and try again!';
            } else if (code === 'API_KEY_INVALID' || code.includes('400')) {
                errorText = '⚠️ API key problem. Check your .env file and restart the app.';
            } else if (code === 'QUOTA_EXCEEDED' || code.includes('429')) {
                errorText = '⚠️ Gemini quota reached. Try again later.';
            } else if (code === 'EMPTY_RESPONSE') {
                errorText = '⚠️ Empty response. Try rephrasing your question.';
            }

            const withError = [
                ...withUser.filter(m => m.id !== 'loading'),
                { id: Date.now().toString() + '-err', role: 'ai' as const, text: errorText },
            ];
            setMessages(withError);
            persistMessages(withError);
        } finally {
            setIsTyping(false);
            scrollToBottom();
        }
    }

    function clearChat() {
        const fresh: UIMessage[] = [{
            id: 'intro-' + Date.now(),
            role: 'ai',
            text: `Chat cleared! I'm on Page ${currentPageIndex + 1} of ${folderName}. Ask me anything! ✦`,
        }];
        setMessages(fresh);
        geminiHistory.current = [];
        saveChatHistory(folderId, []);
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content"
                       backgroundColor={colors.bgSecondary} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={styles.headerCenter}>
                    <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>✦</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>NoteCopilot</Text>
                        <Text style={styles.headerSub} numberOfLines={1}>
                            {folderName} — Page {currentPageIndex + 1}
                        </Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <View style={[
                        styles.scanBadge,
                        { backgroundColor: hasCurrentPageOcr
                                ? 'rgba(74,222,128,0.15)'
                                : 'rgba(255,229,102,0.12)' },
                    ]}>
                        <View style={[
                            styles.onlineDot,
                            { backgroundColor: hasCurrentPageOcr ? '#4ADE80' : '#FFE566' },
                        ]} />
                        <Text style={[
                            styles.onlineText,
                            { color: hasCurrentPageOcr ? '#4ADE80' : '#FFE566' },
                        ]}>
                            {scannedCount}/{pageCount}
                        </Text>
                    </View>
                    {messages.length > 1 && (
                        <TouchableOpacity style={styles.clearBtn} onPress={clearChat}>
                            <Text style={styles.clearBtnText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <Animated.View style={[styles.flex, {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                }]}>
                    <ScrollView
                        ref={scrollRef}
                        style={styles.chatArea}
                        contentContainerStyle={styles.chatContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        onContentSizeChange={scrollToBottom}
                    >
                        {/* Current page context card */}
                        <View style={styles.contextCard}>
                            <View style={styles.contextHeader}>
                                <Text style={styles.contextIcon}>📄</Text>
                                <Text style={styles.contextTitle}>
                                    Page {currentPageIndex + 1} of {pageCount}
                                </Text>
                                <Text style={styles.contextPages}>
                                    {scannedCount}/{pageCount} scanned
                                </Text>
                            </View>
                            <Text style={styles.contextHint}>
                                {hasCurrentPageOcr
                                    ? '✅ This page is scanned. AI will answer based on it.'
                                    : '⚡ This page is not scanned yet. Add it via the Organizer.'}
                            </Text>
                        </View>

                        {/* Quick actions */}
                        <View style={styles.actionsWrap}>
                            <Text style={styles.actionsLabel}>Quick Actions</Text>
                            <View style={styles.actionsGrid}>
                                {QUICK_ACTIONS.map(action => (
                                    <TouchableOpacity
                                        key={action.label}
                                        style={[
                                            styles.actionChip,
                                            isTyping && styles.actionChipDisabled,
                                        ]}
                                        onPress={() => sendMessage(action.prompt)}
                                        disabled={isTyping}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.actionChipText}>{action.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>chat</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        {/* Messages */}
                        {messages.map(msg => (
                            <View
                                key={msg.id}
                                style={[
                                    styles.msgRow,
                                    msg.role === 'user' ? styles.msgRowUser : styles.msgRowAI,
                                ]}
                            >
                                {msg.role === 'ai' && (
                                    <View style={styles.aiAvatar}>
                                        <Text style={styles.aiAvatarText}>✦</Text>
                                    </View>
                                )}
                                <View style={[
                                    styles.bubble,
                                    msg.role === 'user' ? styles.bubbleUser : styles.bubbleAI,
                                ]}>
                                    {msg.loading ? (
                                        <View style={styles.loadingRow}>
                                            <ActivityIndicator size="small" color={colors.purpleSoft} />
                                            <Text style={styles.loadingText}>Thinking...</Text>
                                        </View>
                                    ) : (
                                        <Text style={[
                                            styles.bubbleText,
                                            msg.role === 'user'
                                                ? styles.bubbleTextUser
                                                : styles.bubbleTextAI,
                                        ]}>
                                            {msg.text}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        ))}

                        <View style={{ height: 20 }} />
                    </ScrollView>

                    {/* ✅ Fix: Input bar with safe area bottom padding */}
                    <View style={[
                        styles.inputBar,
                        { paddingBottom: Math.max(insets.bottom, spacing.lg) },
                    ]}>
                        <TextInput
                            style={styles.input}
                            placeholder="Ask about this page..."
                            placeholderTextColor={colors.textMuted}
                            value={input}
                            onChangeText={setInput}
                            multiline
                            maxLength={500}
                            returnKeyType="send"
                            onSubmitEditing={() => sendMessage()}
                        />
                        <TouchableOpacity
                            style={[
                                styles.sendBtn,
                                (!input.trim() || isTyping) && styles.sendBtnDisabled,
                            ]}
                            onPress={() => sendMessage()}
                            disabled={!input.trim() || isTyping}
                        >
                            <Text style={styles.sendBtnText}>↑</Text>
                        </TouchableOpacity>
                    </View>
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    flex:               { flex: 1 },
    container:          { flex: 1, backgroundColor: colors.bgPrimary },
    header:             { flexDirection: 'row', alignItems: 'center',
        paddingTop: 52, paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.bgSecondary,
        borderBottomWidth: 2,
        borderBottomColor: colors.borderDim, gap: 10 },
    backBtn:            { width: 36, height: 36,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md, borderWidth: 2,
        borderColor: colors.borderSoft,
        alignItems: 'center', justifyContent: 'center' },
    backBtnText:        { fontSize: 18, color: colors.yellow, fontWeight: '700' },
    headerCenter:       { flex: 1, flexDirection: 'row',
        alignItems: 'center', gap: 10 },
    aiBadge:            { width: 36, height: 36, borderRadius: 12,
        backgroundColor: colors.purple,
        borderWidth: 2, borderColor: '#000',
        alignItems: 'center', justifyContent: 'center',
        flexShrink: 0 },
    aiBadgeText:        { fontSize: 16, color: '#fff', fontWeight: '800' },
    headerTitle:        { fontSize: 15, fontWeight: '800',
        color: colors.textPrimary },
    headerSub:          { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
    headerRight:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
    scanBadge:          { flexDirection: 'row', alignItems: 'center',
        gap: 5, borderRadius: radius.full,
        paddingHorizontal: 8, paddingVertical: 4 },
    onlineDot:          { width: 7, height: 7, borderRadius: 4 },
    onlineText:         { fontSize: 11, fontWeight: '800' },
    clearBtn:           { backgroundColor: colors.bgCard,
        borderRadius: radius.md, borderWidth: 1.5,
        borderColor: colors.borderSoft,
        paddingHorizontal: 10, paddingVertical: 4 },
    clearBtnText:       { fontSize: 11, fontWeight: '700', color: colors.textMuted },
    chatArea:           { flex: 1 },
    chatContent:        { padding: spacing.lg, gap: 12 },
    contextCard:        { backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.borderDim,
        padding: spacing.md, marginBottom: spacing.sm },
    contextHeader:      { flexDirection: 'row', alignItems: 'center',
        gap: 8, marginBottom: 6 },
    contextIcon:        { fontSize: 16 },
    contextTitle:       { fontSize: 14, fontWeight: '800',
        color: colors.textPrimary, flex: 1 },
    contextPages:       { fontSize: 11, fontWeight: '700', color: colors.textMuted },
    contextHint:        { fontSize: 12, color: colors.textMuted,
        fontWeight: '600', lineHeight: 18 },
    actionsWrap:        { marginBottom: spacing.sm },
    actionsLabel:       { fontSize: 11, fontWeight: '800',
        color: colors.textMuted, textTransform: 'uppercase',
        letterSpacing: 0.8, marginBottom: 10 },
    actionsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    actionChip:         { backgroundColor: colors.bgCardDeep,
        borderRadius: radius.full, borderWidth: 2,
        borderColor: colors.purple,
        paddingHorizontal: 14, paddingVertical: 8 },
    actionChipDisabled: { opacity: 0.4 },
    actionChipText:     { fontSize: 12, fontWeight: '700', color: colors.purpleSoft },
    divider:            { flexDirection: 'row', alignItems: 'center',
        gap: 8, marginBottom: spacing.sm },
    dividerLine:        { flex: 1, height: 1, backgroundColor: colors.borderDim },
    dividerText:        { fontSize: 10, fontWeight: '700', color: colors.textMuted,
        textTransform: 'uppercase', letterSpacing: 0.8 },
    msgRow:             { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
    msgRowUser:         { justifyContent: 'flex-end' },
    msgRowAI:           { justifyContent: 'flex-start' },
    aiAvatar:           { width: 28, height: 28, borderRadius: 10,
        backgroundColor: colors.purple,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: '#000', flexShrink: 0 },
    aiAvatarText:       { fontSize: 12, color: '#fff', fontWeight: '800' },
    bubble:             { maxWidth: '78%', borderRadius: radius.lg,
        paddingHorizontal: 14, paddingVertical: 10, borderWidth: 2 },
    bubbleUser:         { backgroundColor: colors.purple,
        borderColor: '#000', borderBottomRightRadius: 4 },
    bubbleAI:           { backgroundColor: colors.bgCard,
        borderColor: colors.borderDim, borderBottomLeftRadius: 4 },
    bubbleText:         { fontSize: 13, fontWeight: '600', lineHeight: 20 },
    bubbleTextUser:     { color: '#fff' },
    bubbleTextAI:       { color: colors.textPrimary },
    loadingRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
    loadingText:        { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    inputBar:           { flexDirection: 'row', alignItems: 'flex-end',
        gap: 8, paddingTop: spacing.md,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.bgSecondary,
        borderTopWidth: 2, borderTopColor: colors.borderDim },
    input:              { flex: 1, backgroundColor: colors.bgCard,
        borderWidth: 2, borderColor: colors.borderSoft,
        borderRadius: radius.lg,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: 13, fontWeight: '600',
        color: colors.textPrimary, maxHeight: 100 },
    sendBtn:            { width: 40, height: 40, backgroundColor: colors.purple,
        borderRadius: 14, borderWidth: 2, borderColor: '#000',
        alignItems: 'center', justifyContent: 'center',
        marginBottom: 2 },
    sendBtnDisabled:    { backgroundColor: colors.bgCard, borderColor: colors.border },
    sendBtnText:        { fontSize: 18, color: '#fff', fontWeight: '800' },
});