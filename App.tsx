import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Import Nav and Stores
import AppNavigator from './src/navigation/AppNavigator';
import { useFolderStore } from './src/store/folderStore';
import { useStatsStore } from './src/store/statsStore';
import { colors } from './src/theme/theme';

function LoadingScreen() {
    return (
        <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.yellow} />
        </View>
    );
}

export default function App() {
    const hydrateFolders = useFolderStore(s => s.hydrate);
    const hydratedFolders = useFolderStore(s => s.hydrated);
    const hydrateStats = useStatsStore(s => s.hydrate);
    const hydratedStats = useStatsStore(s => s.hydrated);

    useEffect(() => {
        async function init() {
            try {
                console.log("🚀 [DEBUG] Starting App Init...");

                // 1. Check Permissions
                console.log("📸 [DEBUG] Requesting Permissions...");
                await ImagePicker.requestCameraPermissionsAsync();
                await ImagePicker.requestMediaLibraryPermissionsAsync();
                console.log("✅ [DEBUG] Permissions Granted");

                // 2. Check Folder Store
                console.log("📂 [DEBUG] Hydrating Folders...");
                await hydrateFolders();
                console.log("📂 [DEBUG] Folders Hydrated!");

                // 3. Check Stats Store
                console.log("📊 [DEBUG] Hydrating Stats...");
                await hydrateStats();
                console.log("📊 [DEBUG] Stats Hydrated!");

            } catch (e) {
                console.error("❌ [DEBUG] INIT CRASHED! Error:", e);
            }
        }
        init();
    }, []);

    const ready = hydratedFolders && hydratedStats;
    console.log("🎨 [DEBUG] Rendering UI. Ready State:", ready);

    return (
        <SafeAreaProvider>
            <StatusBar style="light" />
            {ready ? <AppNavigator /> : <LoadingScreen />}
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    loading: {
        flex: 1,
        backgroundColor: colors.bgPrimary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    debugOverlay: {
        flex: 1,
        backgroundColor: 'red', // Bright red to be unmistakable
        justifyContent: 'center',
        alignItems: 'center',
        padding: 30,
    },
    debugTitle: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 20,
    },
    debugStatus: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.3)',
        padding: 10,
        borderRadius: 8,
    },
    debugSub: {
        color: 'white',
        marginTop: 20,
        fontSize: 12,
        fontStyle: 'italic',
        opacity: 0.8,
    }
});