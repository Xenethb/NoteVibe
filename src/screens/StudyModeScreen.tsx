import React, { useState, useRef, useEffect } from 'react';
import { useStatsStore } from '../store/statsStore';
import PagerView from 'react-native-pager-view';
import ImageZoom from 'react-native-image-pan-zoom';

import {
    View, Text, StyleSheet, TouchableOpacity,
    Dimensions, Image, Animated, StatusBar,
    Modal, Pressable, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, radius } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFolderStore } from '../store/folderStore';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
// --- FIXED: Single declaration of W and H ---
const { width: W, height: H } = Dimensions.get('window');
const ImageZoomComponent = ImageZoom as any;

type Nav = StackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'StudyMode'>;

export default function StudyModeScreen() {
    const navigation = useNavigation<Nav>();
    const route = useRoute<Route>();
    const { folderId, folderName } = route.params;

    const { folders, addPages, touchFolder } = useFolderStore();
    const folder = folders.find(f => f.id === folderId);
    const pages = folder?.pages ?? [];

    const recordSession = useStatsStore(s => s.recordSession);
    const addDayTime = useStatsStore(s => s.addDayTime);
    const addStudyTime = useFolderStore(s => s.addStudyTime);
    const sessionStart = useRef(Date.now());

    // --- GESTURE FIX: Track the zoom scale ---
    const scaleRef = useRef(1);

    const [currentPage, setCurrentPage] = useState(0);
    const [overlayVisible, setOverlayVisible] = useState(true);
    const [menuVisible, setMenuVisible] = useState(false);
    const overlayOpacity = useRef(new Animated.Value(1)).current;

    //for the pdf export option
    const [exportVisible, setExportVisible] = useState(false);
    const [exportProgress, setExportProgress] = useState('');
    const [exportStep, setExportStep] = useState(0);

    useEffect(() => {
        touchFolder(folderId);
        recordSession();
        sessionStart.current = Date.now();

        return () => {
            const seconds = Math.floor((Date.now() - sessionStart.current) / 1000);
            if (seconds > 5) {
                addStudyTime(folderId, seconds);
                addDayTime(seconds);
            }
        };
    }, []);

    function toggleOverlay() {
        const toValue = overlayVisible ? 0 : 1;
        Animated.timing(overlayOpacity, {
            toValue, duration: 200, useNativeDriver: true,
        }).start();
        setOverlayVisible(!overlayVisible);
    }

    async function pickImages() {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.85,
        });
        if (!result.canceled) {
            const uris = result.assets.map(a => a.uri);
            addPages(folderId, uris);
        }
    }

    async function takePhoto() {
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.85,
        });
        if (!result.canceled) {
            addPages(folderId, [result.assets[0].uri]);
        }
    }

    async function handleExportPDF() {
        // Step 1 — confirmation alert
        Alert.alert(
            'Export to PDF',
            `This will convert all ${pages.length} page${pages.length !== 1 ? 's' : ''} in "${folderName}" into a PDF file. Continue?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Yes, Export',
                    onPress: () => runExport(),
                },
            ]
        );
    }

    async function runExport() {
        setExportVisible(true);
        setExportStep(0);
        let pdfUri: string | null = null;

        try {
            // Step 2 — compress each image
            const compressedBase64s: string[] = [];

            for (let i = 0; i < pages.length; i++) {
                setExportProgress(`Compressing page ${i + 1} of ${pages.length}...`);
                setExportStep(i + 1);

                const manipulated = await ImageManipulator.manipulateAsync(
                    pages[i],
                    [{ resize: { width: 2000 } }],
                    {
                        compress: 0.9,
                        format: ImageManipulator.SaveFormat.JPEG,
                        base64: true,
                    }
                );

                if (manipulated.base64) {
                    compressedBase64s.push(manipulated.base64);
                }
            }

            // Step 3 — build HTML
            setExportProgress('Building PDF...');

            const pageHtml = compressedBase64s
                .map((b64, i) => {
                    const isLast = i === compressedBase64s.length - 1;
                    return `
          <div style="
            width: 100%;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            ${!isLast ? 'page-break-after: always;' : ''}
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          ">
            <img
              src="data:image/jpeg;base64,${b64}"
              style="
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                display: block;
              "
            />
          </div>
        `;
                })
                .join('');

            const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8"/>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { background: #fff; }
            @page { margin: 0; }
          </style>
        </head>
        <body>${pageHtml}</body>
      </html>
    `;

            // Step 4 — generate PDF
            setExportProgress('Generating PDF file...');

            const { uri } = await Print.printToFileAsync({
                html,
                base64: false,
            });

            pdfUri = uri;

            // Step 5 — share
            setExportProgress('Opening share menu...');
            setExportVisible(false);

            const canShare = await Sharing.isAvailableAsync();
            if (canShare) {
                await Sharing.shareAsync(pdfUri, {
                    mimeType: 'application/pdf',
                    dialogTitle: `Share ${folderName} notes`,
                    UTI: 'com.adobe.pdf',
                });
            } else {
                Alert.alert('Sharing not available', 'Your device does not support sharing.');
            }

        } catch (e) {
            setExportVisible(false);
            console.warn('PDF export error:', e);
            Alert.alert(
                'Export Failed',
                'Something went wrong while creating the PDF. Please try again.'
            );
        } finally {
            // Step 6 — always delete temp file whether user shared or not
            if (pdfUri) {
                try {
                    await FileSystem.deleteAsync(pdfUri, { idempotent: true });
                    console.log('✅ Temp PDF deleted');
                } catch (e) {
                    console.warn('Could not delete temp PDF:', e);
                }
            }
        }
    }

    function EmptyState() {
        return (
            <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyTitle}>No pages yet</Text>
                <Text style={styles.emptySubtitle}>Add your first note to get started</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={pickImages}>
                    <Text style={styles.emptyBtnText}>🖼️  Pick from Gallery</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.bgCard, marginTop: 10 }]} onPress={takePhoto}>
                    <Text style={[styles.emptyBtnText, { color: colors.yellow }]}>📷  Take a Photo</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={colors.bgPrimary} />

            {pages.length === 0 ? (
                <EmptyState />
            ) : (
                <PagerView
                    style={styles.pagerTouch}
                    initialPage={0}
                    onPageSelected={(e) => {
                        setCurrentPage(e.nativeEvent.position);
                        // Reset scale when flipping pages
                        scaleRef.current = 1;
                    }}
                >
                    {pages.map((uri, index) => (
                        <View key={index} style={styles.pageContainer}>
                            <ImageZoomComponent
                                cropWidth={W}
                                cropHeight={H}
                                imageWidth={W}
                                imageHeight={H}
                                minScale={1}
                                maxScale={4}
                                onMove={(data: any) => {
                                    scaleRef.current = data.scale;
                                }}
                                // 1. ALWAYS start listening so we can catch the "onClick"
                                onStartShouldSetPanResponder={() => true}

                                // 2. ONLY stay in control if we are zooming (2 fingers) or already zoomed in.
                                // If it's a 1-finger movement at scale 1, we return false so the PagerView flips the page.
                                onMoveShouldSetPanResponder={(e: any, gestureState: any) => {
                                    const isZooming = gestureState.numberActiveTouches > 1;
                                    const isZoomedIn = scaleRef.current > 1;

                                    return isZooming || isZoomedIn;
                                }}

                                // 3. This will now fire correctly because we "started" the responder
                                onClick={() => {
                                    toggleOverlay();
                                }}
                            >
                                <Image
                                    source={{ uri: uri }}
                                    style={styles.pageImage}
                                    resizeMode="contain"
                                />
                            </ImageZoomComponent>
                        </View>
                    ))}
                </PagerView>
            )}

            {/* Overlay */}
            <Animated.View
                style={[styles.overlay, { opacity: overlayOpacity }]}
                pointerEvents={overlayVisible ? 'box-none' : 'none'}
            >
                <View style={styles.overlayTop}>
                    <TouchableOpacity style={styles.overlayBtn} onPress={() => navigation.goBack()}>
                        <Text style={styles.overlayBtnText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.overlayTitle} numberOfLines={1}>{folderName}</Text>
                    <View style={styles.overlayActions}>
                        <TouchableOpacity style={[styles.overlayBtn, styles.aiBadge]} onPress={() => navigation.navigate('AICopilot', {
                            folderId,
                            folderName,
                            currentPageUri: pages[currentPage] ?? '',
                            currentPageIndex: currentPage, })}>
                            <Text style={styles.overlayBtnText}>✦</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.overlayBtn} onPress={() => navigation.navigate('Organizer', { folderId, folderName })}>
                            <Text style={styles.overlayBtnText}>⊞</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.overlayBtn} onPress={() => setMenuVisible(true)}>
                            <Text style={styles.overlayBtnText}>⋮</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {pages.length > 0 && (
                    <View style={styles.overlayBottom}>
                        <View style={styles.dotsRow}>
                            {pages.map((_, i) => (
                                <View key={i} style={[styles.dot, i === currentPage && styles.dotActive]} />
                            ))}
                        </View>
                        <Text style={styles.pageCounter}>{currentPage + 1} / {pages.length}</Text>
                        <Text style={styles.swipeHint}>← swipe to flip pages →</Text>
                    </View>
                )}
            </Animated.View>

            {/* 3-dot menu Modal (Keep your existing modal code here) */}
            <Modal transparent visible={menuVisible} animationType="fade" onRequestClose={() => setMenuVisible(false)}>
                <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
                    <View style={styles.dotMenu}>
                        <TouchableOpacity style={styles.dotMenuItem} onPress={() => { setMenuVisible(false); pickImages(); }}>
                            <Text style={styles.dotMenuIcon}>🖼️</Text>
                            <Text style={styles.dotMenuLabel}>Add More Pages</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dotMenuItem} onPress={() => { setMenuVisible(false); takePhoto(); }}>
                            <Text style={styles.dotMenuIcon}>📷</Text>
                            <Text style={styles.dotMenuLabel}>Snap a Note</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dotMenuItem} onPress={() => { setMenuVisible(false); handleExportPDF(); }}>
                            <Text style={styles.dotMenuIcon}>📄</Text>
                            <Text style={styles.dotMenuLabel}>Export to PDF</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Export Progress Modal — blocks exit while generating */}
            <Modal
                transparent
                visible={exportVisible}
                animationType="fade"
                onRequestClose={() => {}} // empty — user cannot dismiss
            >
                <View style={styles.exportOverlay}>
                    <View style={styles.exportCard}>
                        <ActivityIndicator size="large" color={colors.yellow} />
                        <Text style={styles.exportTitle}>Creating PDF</Text>
                        <Text style={styles.exportSub}>{exportProgress}</Text>

                        {/* Progress bar */}
                        <View style={styles.exportTrack}>
                            <View style={[
                                styles.exportFill,
                                { width: pages.length > 0
                                        ? `${(exportStep / pages.length) * 100}%`
                                        : '0%' },
                            ]} />
                        </View>

                        <Text style={styles.exportNote}>
                            Please wait — do not close the app
                        </Text>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

const styles = StyleSheet.create({
    container:      { flex: 1, backgroundColor: '#0F0E1A' },
    pagerTouch:     { flex: 1 },
    pageContainer:  { width: W, height: H, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F0E1A' },
    pageImage:      { width: W, height: H },
    overlay:        { position: 'absolute', inset: 0, justifyContent: 'space-between' },
    overlayTop:     { flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, backgroundColor: 'rgba(0,0,0,0.55)' },
    overlayBtn:     { width: 36, height: 36, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    aiBadge:        { backgroundColor: 'rgba(124,92,255,0.55)', borderColor: 'rgba(150,120,255,0.5)' },
    overlayBtnText: { fontSize: 16, color: '#fff', fontWeight: '700' },
    overlayTitle:   { flex: 1, fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginHorizontal: spacing.sm },
    overlayActions: { flexDirection: 'row', gap: 8 },
    overlayBottom:  { paddingBottom: 40, paddingHorizontal: spacing.lg, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
    dotsRow:        { flexDirection: 'row', gap: 5, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'center' },
    dot:            { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)' },
    dotActive:      { backgroundColor: colors.yellow, width: 14 },
    pageCounter:    { fontSize: 13, fontWeight: '700', color: colors.textMuted },
    swipeHint:      { fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: '600', marginTop: 4 },
    emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
    emptyEmoji:     { fontSize: 52, marginBottom: 12 },
    emptyTitle:     { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
    emptySubtitle:  { fontSize: 14, color: colors.textMuted, fontWeight: '600', textAlign: 'center', marginBottom: 28 },
    emptyBtn:       { backgroundColor: colors.yellow, borderRadius: radius.lg, borderWidth: 2.5, borderColor: '#000', paddingVertical: 12, paddingHorizontal: 24, width: '100%', alignItems: 'center' },
    emptyBtnText:   { fontSize: 15, fontWeight: '800', color: colors.textDark },
    menuOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    dotMenu:        { backgroundColor: colors.bgSecondary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 2, borderColor: colors.borderSoft, paddingBottom: 32 },
    dotMenuItem:    { flexDirection: 'row', alignItems: 'center', gap: 14, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
    dotMenuIcon:    { fontSize: 20 },
    dotMenuLabel:   { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    exportOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
        alignItems: 'center', justifyContent: 'center',
        padding: spacing.xl },
    exportCard:     { backgroundColor: colors.bgSecondary,
        borderRadius: radius.xl, borderWidth: 2.5,
        borderColor: colors.borderSoft,
        padding: spacing.xl, width: '100%',
        alignItems: 'center', gap: 14 },
    exportTitle:    { fontSize: 20, fontWeight: '800',
        color: colors.textPrimary },
    exportSub:      { fontSize: 13, fontWeight: '600',
        color: colors.textMuted, textAlign: 'center' },
    exportTrack:    { width: '100%', height: 10,
        backgroundColor: colors.bgCard,
        borderRadius: 5, overflow: 'hidden' },
    exportFill:     { height: '100%', backgroundColor: colors.yellow,
        borderRadius: 5 },
    exportNote:     { fontSize: 11, fontWeight: '600',
        color: colors.textMuted, textAlign: 'center' },
});