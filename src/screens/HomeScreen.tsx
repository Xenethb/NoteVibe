import React, { useState } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity,
    StyleSheet, Modal, TextInput, Pressable,
    Alert, StatusBar, Image, // 👈 Just add this!
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, radius, folderPalette } from '../theme/theme';
import { RootStackParamList } from '../navigation/AppNavigator';
import { useFolderStore } from '../store/folderStore';

type Nav = StackNavigationProp<RootStackParamList>;

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
}

export default function HomeScreen() {
    const navigation = useNavigation<Nav>();
    const { folders, addFolder, deleteFolder, renameFolder } = useFolderStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [newName, setNewName] = useState('');
    const [contextFolder, setContextFolder] = useState<string | null>(null);
    const [renameVisible, setRenameVisible] = useState(false);
    const [renameName, setRenameName] = useState('');

    const sorted = [...folders].sort((a, b) => b.lastOpened - a.lastOpened);
    const contextFolderData = folders.find(f => f.id === contextFolder);

    function createFolder() {
        if (!newName.trim()) return;
        addFolder(newName.trim(), folders.length % folderPalette.length);
        setModalVisible(false);
        setNewName('');
    }

    function startRename() {
        setRenameName(contextFolderData?.name ?? '');
        setContextFolder(null);
        setRenameVisible(true);
    }

    function confirmRename() {
        if (!renameName.trim() || !contextFolder) return;
        renameFolder(contextFolder, renameName.trim());
        setRenameVisible(false);
    }

    function confirmDelete() {
        Alert.alert(
            'Delete Folder',
            `Delete "${contextFolderData?.name}"? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive',
                    onPress: () => {
                        deleteFolder(contextFolder!);
                        setContextFolder(null);
                    },
                },
            ]
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content"
                       backgroundColor={colors.bgPrimary} />

            <View style={styles.topBar}>
                <Text style={styles.logo}>NoteVibe</Text>
                <TouchableOpacity style={styles.searchBtn}
                                  onPress={() => navigation.navigate('OCRSearch')}>
                    <Text style={{ fontSize: 18 }}>🔍</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.greeting}>
                <Text style={styles.greetingSub}>Ready to study? ☀️</Text>
                <Text style={styles.greetingMain}>
                    {sorted.length} Subject{sorted.length !== 1 ? 's' : ''}
                </Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.grid}
                showsVerticalScrollIndicator={false}
            >
                {sorted.length === 0 && (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyEmoji}>📭</Text>
                        <Text style={styles.emptyText}>
                            No subjects yet.{'\n'}Tap + to create your first folder!
                        </Text>
                    </View>
                )}
                {sorted.map((folder) => {
                    const palette = folderPalette[folder.paletteIndex];
                    return (
                        <TouchableOpacity
                            key={folder.id}
                            style={[styles.folderCard, { backgroundColor: palette.bg }]}
                            onPress={() => navigation.navigate('StudyMode', {
                                folderId: folder.id,
                                folderName: folder.name,
                            })}
                            onLongPress={() => setContextFolder(folder.id)}
                            activeOpacity={0.85}
                        >
                            <View style={[styles.folderTab,
                                { backgroundColor: palette.tab }]} />
                            <View style={styles.folderBody}>
                                {folder.pages.length > 0 ? (
                                    // Show actual first image if pages exist
                                    <View style={styles.folderPage}>
                                        <Image
                                            source={{ uri: folder.pages[0] }}
                                            style={{ width: '100%', height: '100%', borderRadius: 4 }}
                                            resizeMode="cover"
                                        />
                                    </View>
                                ) : (
                                    <View style={styles.folderPage}>
                                        <View style={styles.pageLine} />
                                        <View style={[styles.pageLine, { width: '60%' }]} />
                                        <View style={styles.pageLine} />
                                        <View style={[styles.pageLine, { width: '75%' }]} />
                                        <View style={styles.pageLine} />
                                    </View>
                                )}
                            </View>
                            <View style={styles.folderFooter}>
                                <Text style={styles.folderName} numberOfLines={1}>
                                    {folder.name}
                                </Text>
                                <Text style={styles.folderMeta}>
                                    {timeAgo(folder.lastOpened)} • {folder.pages.length} pages
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <TouchableOpacity style={styles.fab}
                              onPress={() => { setNewName(''); setModalVisible(true); }}
                              activeOpacity={0.8}>
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Context Menu */}
            <Modal transparent visible={!!contextFolder}
                   onRequestClose={() => setContextFolder(null)}>
                <Pressable style={styles.overlay}
                           onPress={() => setContextFolder(null)}>
                    <View style={styles.contextMenu}>
                        <Text style={styles.contextTitle} numberOfLines={1}>
                            {contextFolderData?.name}
                        </Text>
                        <TouchableOpacity style={styles.contextItem}
                                          onPress={startRename}>
                            <Text style={styles.contextIcon}>✏️</Text>
                            <Text style={styles.contextLabel}>Rename</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.contextItem}
                                          onPress={confirmDelete}>
                            <Text style={styles.contextIcon}>🗑️</Text>
                            <Text style={[styles.contextLabel,
                                { color: colors.danger }]}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* Rename Modal */}
            <Modal transparent visible={renameVisible} animationType="fade"
                   onRequestClose={() => setRenameVisible(false)}>
                <Pressable style={styles.overlay}
                           onPress={() => setRenameVisible(false)}>
                    <Pressable style={styles.newFolderModal}>
                        <Text style={styles.modalEmoji}>✏️</Text>
                        <Text style={styles.modalTitle}>Rename Subject</Text>
                        <TextInput
                            style={styles.modalInput}
                            value={renameName}
                            onChangeText={setRenameName}
                            autoFocus
                            onSubmitEditing={confirmRename}
                            placeholderTextColor="rgba(28,27,46,0.4)"
                        />
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.cancelBtn}
                                              onPress={() => setRenameVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.okBtn}
                                              onPress={confirmRename}>
                                <Text style={styles.okBtnText}>Save →</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>

            {/* New Folder Modal */}
            <Modal transparent visible={modalVisible} animationType="slide"
                   onRequestClose={() => setModalVisible(false)}>
                <Pressable style={styles.overlay}
                           onPress={() => setModalVisible(false)}>
                    <Pressable style={styles.newFolderModal}>
                        <Text style={styles.modalEmoji}>📂</Text>
                        <Text style={styles.modalTitle}>Name Your Subject</Text>
                        <TextInput
                            style={styles.modalInput}
                            placeholder="e.g. Quantum Physics"
                            placeholderTextColor="rgba(28,27,46,0.4)"
                            value={newName}
                            onChangeText={setNewName}
                            autoFocus
                            onSubmitEditing={createFolder}
                        />
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity style={styles.cancelBtn}
                                              onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.okBtn}
                                              onPress={createFolder}>
                                <Text style={styles.okBtnText}>Okay! →</Text>
                            </TouchableOpacity>
                        </View>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container:      { flex: 1, backgroundColor: colors.bgPrimary },
    topBar:         { flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: 52, paddingBottom: spacing.md },
    logo:           { fontSize: 28, color: colors.yellow,
        fontWeight: '800', letterSpacing: 1 },
    searchBtn:      { width: 40, height: 40,
        backgroundColor: colors.bgCard,
        borderRadius: radius.md, borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center' },
    greeting:       { paddingHorizontal: spacing.lg,
        paddingBottom: spacing.md },
    greetingSub:    { fontSize: 13, color: colors.textMuted,
        fontWeight: '600' },
    greetingMain:   { fontSize: 20, color: colors.textPrimary,
        fontWeight: '800', marginTop: 2 },
    grid:           { flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: spacing.md,
        paddingBottom: 160, gap: 12 },
    emptyState:     { width: '100%', alignItems: 'center',
        paddingTop: 60 },
    emptyEmoji:     { fontSize: 48, marginBottom: 12 },
    emptyText:      { fontSize: 15, color: colors.textMuted,
        fontWeight: '600', textAlign: 'center',
        lineHeight: 24 },
    folderCard:     { width: '47%', borderRadius: radius.lg,
        borderWidth: 2.5, borderColor: '#000',
        overflow: 'hidden' },
    folderTab:      { height: 12, width: '55%', borderRadius: 6,
        marginLeft: 10 },
    folderBody:     { height: 110, alignItems: 'center',
        justifyContent: 'center' },
    folderPage:     { width: 72, height: 85,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 6, borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.18)',
        padding: 10, gap: 6,
        alignItems: 'center', justifyContent: 'center' },
    pageLine:       { height: 3, width: '100%',
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2 },
    folderFooter:   { padding: spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.2)' },
    folderName:     { fontSize: 13, fontWeight: '800', color: '#fff' },
    folderMeta:     { fontSize: 10,
        color: 'rgba(255,255,255,0.55)',
        fontWeight: '600', marginTop: 2 },
    fab:            { position: 'absolute', bottom: 115, right: 20,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.yellow,
        borderWidth: 3, borderColor: '#000',
        alignItems: 'center', justifyContent: 'center',
        elevation: 8 },
    fabText:        { fontSize: 28, fontWeight: '800',
        color: colors.textDark, lineHeight: 32 },
    overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center', justifyContent: 'center' },
    contextMenu:    { backgroundColor: colors.bgSecondary,
        borderRadius: radius.lg, borderWidth: 2,
        borderColor: colors.borderSoft,
        width: 200, overflow: 'hidden' },
    contextTitle:   { fontSize: 12, fontWeight: '800',
        color: colors.textMuted, padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDim },
    contextItem:    { flexDirection: 'row', alignItems: 'center',
        gap: 10, padding: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderDim },
    contextIcon:    { fontSize: 16 },
    contextLabel:   { fontSize: 14, fontWeight: '700',
        color: colors.textPrimary },
    newFolderModal: { backgroundColor: colors.yellow,
        borderRadius: radius.xl, borderWidth: 3,
        borderColor: '#000', padding: spacing.lg,
        width: 280, alignItems: 'center',
        elevation: 10 },
    modalEmoji:     { fontSize: 32, marginBottom: 4 },
    modalTitle:     { fontSize: 20, fontWeight: '800',
        color: colors.textDark,
        marginBottom: spacing.md },
    modalInput:     { width: '100%',
        backgroundColor: 'rgba(255,255,255,0.6)',
        borderWidth: 2.5, borderColor: colors.textDark,
        borderRadius: radius.md, padding: spacing.md,
        fontSize: 14, fontWeight: '700',
        color: colors.textDark },
    modalBtnRow:    { flexDirection: 'row', gap: 10,
        marginTop: spacing.md, width: '100%' },
    cancelBtn:      { flex: 1, padding: spacing.md,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: radius.md, borderWidth: 2.5,
        borderColor: colors.textDark,
        alignItems: 'center' },
    cancelBtnText:  { fontSize: 14, fontWeight: '800',
        color: colors.textDark },
    okBtn:          { flex: 1, padding: spacing.md,
        backgroundColor: colors.textDark,
        borderRadius: radius.md, borderWidth: 2.5,
        borderColor: colors.textDark,
        alignItems: 'center', elevation: 3 },
    okBtnText:      { fontSize: 14, fontWeight: '800',
        color: colors.yellow },
});