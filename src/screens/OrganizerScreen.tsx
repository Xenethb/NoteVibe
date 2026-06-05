import React, { useState, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    Image, Dimensions, Modal, Pressable,
    StatusBar, Alert, ScrollView, PanResponder,
    Animated,
} from 'react-native';
import { extractTextFromPages } from '../utils/ocrHelper';
import { useFolderStore } from '../store/folderStore'
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';


type Nav = StackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Organizer'>;

const { width: W } = Dimensions.get('window');
const TILE_SIZE = (W - spacing.lg * 2 - spacing.md) / 2;
const TILE_HEIGHT = TILE_SIZE * 1.35;

interface PageItem {
    uri: string;
    key: string;
}

export default function OrganizerScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { folderId, folderName } = route.params;

    const { folders, reorderPages, addPages, removePage } = useFolderStore();
    const folder = folders.find(f => f.id === folderId);
    const rawPages = folder?.pages ?? [];

    const [pages, setPages] = useState<PageItem[]>(
        rawPages.map((uri, i) => ({ uri, key: `page-${i}-${uri}` }))
    );
    const [addModalVisible, setAddModalVisible] = useState(false);
    const [previewUri, setPreviewUri] = useState<string | null>(null);
    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const dragY = useRef(new Animated.Value(0)).current;
    const dragX = useRef(new Animated.Value(0)).current;
    const tilePositions = useRef<{ x: number; y: number }[]>([]);
    const scrollOffset = useRef(0);

    function savePages(newPages: PageItem[]) {
        setPages(newPages);
        reorderPages(folderId, newPages.map(p => p.uri));
    }

    function movePage(from: number, to: number) {
        if (from === to) return;
        const updated = [...pages];
        const [moved] = updated.splice(from, 1);
        updated.splice(to, 0, moved);
        savePages(updated);
    }

    function makePanResponder(index: number) {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (_, g) => {
                // Only start dragging if moved more than 8 pixels
                return Math.abs(g.dy) > 8 || Math.abs(g.dx) > 8;
            },
            onPanResponderGrant: () => {
                // Reset animated values to 0 immediately on start
                dragX.setValue(0);
                dragY.setValue(0);
                setDragIndex(index);
                setDragOverIndex(index);
            },
            onPanResponderMove: (e, g) => {
                // 1. Use the built-in g.dx and g.dy (no jumps!)
                dragX.setValue(g.dx);
                dragY.setValue(g.dy);

                // 2. Calculate which tile we're hovering over
                // We use g.moveX and g.moveY (absolute finger position)
                const hovCol = g.moveX < W / 2 ? 0 : 1;

                // Adjust for scroll and top bar height
                const scrollY = scrollOffset.current;
                const relativeY = g.moveY + scrollY - 120; // 120 is roughly topBar + hintBar height

                const hovRow = Math.floor(
                    (relativeY - spacing.lg) / (TILE_HEIGHT + spacing.md)
                );

                const hovIndex = Math.max(
                    0,
                    Math.min(pages.length - 1, hovRow * 2 + hovCol)
                );

                if (hovIndex !== dragOverIndex) {
                    setDragOverIndex(hovIndex);
                }
            },
            onPanResponderRelease: (_, g) => {
                if (
                    dragOverIndex !== null &&
                    dragIndex !== null &&
                    dragOverIndex !== dragIndex
                ) {
                    movePage(dragIndex, dragOverIndex);
                }
                setDragIndex(null);
                setDragOverIndex(null);
                // Animate back to 0 so it doesn't "snap"
                Animated.spring(dragX, { toValue: 0, useNativeDriver: true }).start();
                Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
            },
            onPanResponderTerminate: () => {
                setDragIndex(null);
                setDragOverIndex(null);
                dragX.setValue(0);
                dragY.setValue(0);
            },
        });
    }

    async function pickImages() {
        setAddModalVisible(false);
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 0.85,
        });

        if (!result.canceled) {
            const uris = result.assets.map(a => a.uri);

            // ✅ Fix: Update BOTH store AND local state immediately
            addPages(folderId, uris);
            const newItems = uris.map((uri, i) => ({
                uri,
                key: `page-${Date.now()}-${i}`,
            }));
            setPages(prev => [...prev, ...newItems]);

            // OCR runs in background — non-blocking
            extractTextFromPages(uris)
                .then(ocrResults => {
                    Object.entries(ocrResults).forEach(([uri, text]) => {
                        useFolderStore.getState().saveOcrText(folderId, uri, text);
                    });
                    console.log(`✅ OCR done: ${Object.keys(ocrResults).length} pages scanned`);
                })
                .catch(e => console.warn('OCR background error:', e));
        }
    }

    async function takePhoto() {
        setAddModalVisible(false);
        try {
            const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
            if (!result.canceled) {
                const uri = result.assets[0].uri;

                // ✅ Fix: Update BOTH store AND local state immediately
                addPages(folderId, [uri]);
                setPages(prev => [...prev, { uri, key: `page-${Date.now()}` }]);

                // OCR in background
                extractTextFromPages([uri])
                    .then(ocrResults => {
                        Object.entries(ocrResults).forEach(([uri, text]) => {
                            useFolderStore.getState().saveOcrText(folderId, uri, text);
                        });
                        console.log('✅ Photo OCR done');
                    })
                    .catch(e => console.warn('Photo OCR error:', e));
            }
        } catch (e) {
            console.error('takePhoto crashed:', e);
        }
    }


    function confirmDelete(index: number) {
        Alert.alert(
            'Delete Page',
            `Delete page ${index + 1}? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        const updated = pages.filter((_, i) => i !== index);
                        setPages(updated);
                        removePage(folderId, index);
                    },
                },
            ]
        );
    }

    // Build rows of 2 for the grid
    const rows: PageItem[][] = [];
    for (let i = 0; i < pages.length; i += 2) {
        rows.push(pages.slice(i, i + 2));
    }

    function renderTile(item: PageItem, index: number) {
        const isDragging = dragIndex === index;
        const isTarget = dragOverIndex === index && dragIndex !== index;
        const panResponder = makePanResponder(index);

        return (
            <Animated.View
                key={item.key}
                {...panResponder.panHandlers}
                style={[
                    styles.thumb,
                    isDragging && styles.thumbDragging,
                    isTarget && styles.thumbTarget,
                    isDragging && {
                        transform: [
                            { translateX: dragX },
                            { translateY: dragY },
                            { scale: 1.06 },
                        ],
                        zIndex: 99,
                    },
                ]}
            >
                <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => {
                        if (dragIndex === null) setPreviewUri(item.uri);
                    }}
                    style={StyleSheet.absoluteFill}
                >
                    <Image
                        source={{ uri: item.uri }}
                        style={styles.thumbImage}
                        resizeMode="cover"
                    />
                </TouchableOpacity>

                {/* Page number badge */}
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{index + 1}</Text>
                </View>

                {/* Drag handle hint */}
                <View style={styles.dragHandle}>
                    <Text style={styles.dragHandleText}>⠿</Text>
                </View>

                {/* Delete button */}
                <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(index)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                >
                    <Text style={styles.deleteBtnText}>✕</Text>
                </TouchableOpacity>
            </Animated.View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content"
                       backgroundColor={colors.bgSecondary} />

            {/* Top Bar */}
            <View style={styles.topBar}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.backBtnText}>←</Text>
                </TouchableOpacity>
                <View style={styles.topCenter}>
                    <Text style={styles.topTitle} numberOfLines={1}>
                        {folderName}
                    </Text>
                    <Text style={styles.topSub}>
                        {pages.length} page{pages.length !== 1 ? 's' : ''}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.doneBtn}
                    onPress={() => navigation.goBack()}
                >
                    <Text style={styles.doneBtnText}>Done ✓</Text>
                </TouchableOpacity>
            </View>

            {/* Hint bar */}
            <View style={styles.hintBar}>
                <Text style={styles.hintText}>
                    🤏  Drag to reorder  •  Tap to preview  •  ✕ to delete
                </Text>
            </View>

            {/* Grid */}
            {pages.length === 0 ? (
                <View style={styles.emptyState}>
                    <Text style={styles.emptyEmoji}>🗂️</Text>
                    <Text style={styles.emptyTitle}>No pages yet</Text>
                    <Text style={styles.emptySub}>
                        Add your first note to get started
                    </Text>
                    <TouchableOpacity
                        style={styles.emptyAddBtn}
                        onPress={() => setAddModalVisible(true)}
                    >
                        <Text style={styles.emptyAddBtnText}>+ Add Pages</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={styles.grid}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={e => {
                        scrollOffset.current = e.nativeEvent.contentOffset.y;
                    }}
                >
                    {rows.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.row}>
                            {row.map((item, colIndex) =>
                                renderTile(item, rowIndex * 2 + colIndex)
                            )}
                            {/* If odd number of pages, last row has one tile + add tile */}
                            {row.length === 1 && (
                                <TouchableOpacity
                                    style={styles.addTile}
                                    onPress={() => setAddModalVisible(true)}
                                    activeOpacity={0.75}
                                >
                                    <View style={styles.addCircle}>
                                        <Text style={styles.addPlus}>+</Text>
                                    </View>
                                    <Text style={styles.addLabel}>Add Page</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    ))}

                    {/* Add tile row when pages count is even */}
                    {pages.length % 2 === 0 && (
                        <View style={styles.row}>
                            <TouchableOpacity
                                style={styles.addTile}
                                onPress={() => setAddModalVisible(true)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.addCircle}>
                                    <Text style={styles.addPlus}>+</Text>
                                </View>
                                <Text style={styles.addLabel}>Add Page</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* Add Page Modal */}
            <Modal
                transparent
                visible={addModalVisible}
                animationType="slide"
                onRequestClose={() => setAddModalVisible(false)}
            >
                <Pressable
                    style={styles.modalOverlay}
                    onPress={() => setAddModalVisible(false)}
                >
                    <View style={styles.addSheet}>
                        <View style={styles.sheetHandle} />
                        <Text style={styles.sheetTitle}>Add a Page</Text>
                        <Text style={styles.sheetSub}>
                            Snap a photo or pick from your gallery
                        </Text>
                        <View style={styles.choiceRow}>
                            <TouchableOpacity
                                style={styles.choiceBtn}
                                onPress={takePhoto}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.choiceIcon,
                                    { backgroundColor: colors.yellow }]}>
                                    <Text style={styles.choiceEmoji}>📷</Text>
                                </View>
                                <Text style={styles.choiceName}>Snap It</Text>
                                <Text style={styles.choiceDesc}>
                                    Take a photo with your camera
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.choiceBtn}
                                onPress={pickImages}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.choiceIcon,
                                    { backgroundColor: colors.purpleSoft }]}>
                                    <Text style={styles.choiceEmoji}>🖼️</Text>
                                </View>
                                <Text style={styles.choiceName}>Grab It</Text>
                                <Text style={styles.choiceDesc}>
                                    Pick multiple from gallery
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={styles.sheetCancel}
                            onPress={() => setAddModalVisible(false)}
                        >
                            <Text style={styles.sheetCancelText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Full Screen Preview */}
            <Modal
                transparent
                visible={!!previewUri}
                animationType="fade"
                onRequestClose={() => setPreviewUri(null)}
            >
                <Pressable
                    style={styles.previewOverlay}
                    onPress={() => setPreviewUri(null)}
                >
                    {previewUri && (
                        <Image
                            source={{ uri: previewUri }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                    )}
                    <View style={styles.previewCloseHint}>
                        <Text style={styles.previewCloseText}>
                            Tap anywhere to close
                        </Text>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container:        { flex: 1, backgroundColor: colors.bgPrimary },
    topBar:           { flexDirection: 'row', alignItems: 'center',
        paddingTop: 52, paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.bgSecondary,
        borderBottomWidth: 2,
        borderBottomColor: colors.border, gap: 10 },
    backBtn:          { width: 36, height: 36,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md, borderWidth: 2,
        borderColor: colors.borderSoft,
        alignItems: 'center', justifyContent: 'center' },
    backBtnText:      { fontSize: 18, color: colors.yellow,
        fontWeight: '700' },
    topCenter:        { flex: 1 },
    topTitle:         { fontSize: 18, fontWeight: '800',
        color: colors.textPrimary },
    topSub:           { fontSize: 11, color: colors.textMuted,
        fontWeight: '600', marginTop: 1 },
    doneBtn:          { backgroundColor: colors.yellow,
        borderRadius: radius.md, borderWidth: 2,
        borderColor: '#000', paddingVertical: 6,
        paddingHorizontal: 14 },
    doneBtnText:      { fontSize: 13, fontWeight: '800',
        color: colors.textDark },
    hintBar:          { backgroundColor: colors.bgCard,
        paddingVertical: 8,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.border },
    hintText:         { fontSize: 11, fontWeight: '700',
        color: colors.textMuted },
    grid:             { padding: spacing.lg, paddingBottom: 60 },
    row:              { flexDirection: 'row', gap: spacing.md,
        marginBottom: spacing.md },
    thumb:            { width: TILE_SIZE, height: TILE_HEIGHT,
        borderRadius: radius.lg, borderWidth: 2.5,
        borderColor: colors.border,
        overflow: 'hidden',
        backgroundColor: colors.bgCard },
    thumbDragging:    { borderColor: colors.purple,
        opacity: 0.92, elevation: 16 },
    thumbTarget:      { borderColor: colors.yellow,
        borderWidth: 4,
        transform: [{ scale: 0.95 }],
    },
    thumbImage:       { width: '100%', height: '100%' },
    badge:            { position: 'absolute', top: 7, left: 7,
        backgroundColor: colors.yellow,
        borderRadius: 8, borderWidth: 1.5,
        borderColor: '#000',
        paddingHorizontal: 7, paddingVertical: 2 },
    badgeText:        { fontSize: 11, fontWeight: '800',
        color: colors.textDark },
    dragHandle:       { position: 'absolute', bottom: 7, right: 7,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 6, padding: 4 },
    dragHandleText:   { fontSize: 14,
        color: 'rgba(255,255,255,0.7)' },
    deleteBtn:        { position: 'absolute', top: 7, right: 7,
        width: 24, height: 24,
        backgroundColor: colors.danger,
        borderRadius: 12, borderWidth: 1.5,
        borderColor: '#000', alignItems: 'center',
        justifyContent: 'center' },
    deleteBtnText:    { fontSize: 10, fontWeight: '800',
        color: '#fff' },
    addTile:          { width: TILE_SIZE, height: TILE_HEIGHT,
        borderRadius: radius.lg, borderWidth: 2.5,
        borderColor: colors.borderSoft,
        borderStyle: 'dashed',
        alignItems: 'center', justifyContent: 'center',
        gap: 8 },
    addCircle:        { width: 44, height: 44, borderRadius: 22,
        backgroundColor: colors.yellow,
        borderWidth: 2.5, borderColor: '#000',
        alignItems: 'center', justifyContent: 'center' },
    addPlus:          { fontSize: 26, fontWeight: '800',
        color: colors.textDark, lineHeight: 30 },
    addLabel:         { fontSize: 12, fontWeight: '700',
        color: colors.textMuted },
    emptyState:       { flex: 1, alignItems: 'center',
        justifyContent: 'center', padding: 40 },
    emptyEmoji:       { fontSize: 52, marginBottom: 12 },
    emptyTitle:       { fontSize: 22, fontWeight: '800',
        color: colors.textPrimary, marginBottom: 6 },
    emptySub:         { fontSize: 14, color: colors.textMuted,
        fontWeight: '600', textAlign: 'center',
        marginBottom: 28 },
    emptyAddBtn:      { backgroundColor: colors.yellow,
        borderRadius: radius.lg, borderWidth: 2.5,
        borderColor: '#000', paddingVertical: 12,
        paddingHorizontal: 28 },
    emptyAddBtnText:  { fontSize: 15, fontWeight: '800',
        color: colors.textDark },
    modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end' },
    addSheet:         { backgroundColor: colors.bgSecondary,
        borderTopLeftRadius: radius.xxl,
        borderTopRightRadius: radius.xxl,
        borderTopWidth: 2,
        borderColor: colors.borderSoft,
        paddingBottom: 36, paddingTop: 4 },
    sheetHandle:      { width: 40, height: 4,
        backgroundColor: colors.borderSoft,
        borderRadius: 2, alignSelf: 'center',
        marginBottom: 12, marginTop: 8 },
    sheetTitle:       { fontWeight: '800', fontSize: 20,
        color: colors.textPrimary,
        textAlign: 'center', marginBottom: 4 },
    sheetSub:         { fontSize: 12, color: colors.textMuted,
        fontWeight: '600', textAlign: 'center',
        marginBottom: 20 },
    choiceRow:        { flexDirection: 'row', gap: 12,
        paddingHorizontal: spacing.lg },
    choiceBtn:        { flex: 1, backgroundColor: colors.bgCard,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.borderSoft,
        padding: spacing.lg, alignItems: 'center',
        gap: 8 },
    choiceIcon:       { width: 56, height: 56,
        borderRadius: radius.lg, borderWidth: 2.5,
        borderColor: '#000', alignItems: 'center',
        justifyContent: 'center' },
    choiceEmoji:      { fontSize: 26 },
    choiceName:       { fontSize: 15, fontWeight: '800',
        color: colors.textPrimary },
    choiceDesc:       { fontSize: 11, color: colors.textMuted,
        fontWeight: '600', textAlign: 'center',
        lineHeight: 16 },
    sheetCancel:      { marginTop: 16, alignSelf: 'center' },
    sheetCancelText:  { fontSize: 14, fontWeight: '700',
        color: colors.textMuted },
    previewOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)',
        alignItems: 'center', justifyContent: 'center' },
    previewImage:     { width: W, height: '85%' },
    previewCloseHint: { position: 'absolute', bottom: 40 },
    previewCloseText: { fontSize: 13,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '600' },
});