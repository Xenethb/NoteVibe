import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View , StyleSheet, TouchableOpacity} from 'react-native';
// 1. Import the hook from safe area context
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import StudyModeScreen from '../screens/StudyModeScreen';
import OrganizerScreen from '../screens/OrganizerScreen';
import PetStatsScreen from '../screens/PetStatsScreen';
import OCRSearchScreen from '../screens/OCRSearchScreen';
import AICopilotScreen from '../screens/AICopilotSheet';

import { colors } from '../theme/theme';

export type RootStackParamList = {
    MainTabs: undefined;
    StudyMode: { folderId: string; folderName: string };
    Organizer: { folderId: string; folderName: string };
    AICopilot: {
        folderId: string;
        folderName: string;
        currentPageUri: string;
        currentPageIndex: number;
    };
    OCRSearch: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
    return (
        <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>
    );
}

function MainTabs() {
    const insets = useSafeAreaInsets();
    // This is the height of your Tab Bar + the bottom safe area (gesture bar)
    const tabBarHeight = 60 + insets.bottom;

    return (
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                screenOptions={{
                    headerShown: false,
                    tabBarStyle: {
                        backgroundColor: colors.bgSecondary,
                        borderTopColor: colors.border,
                        borderTopWidth: 2,
                        height: tabBarHeight,
                        paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
                    },
                    tabBarActiveTintColor: colors.yellow,
                    tabBarInactiveTintColor: colors.textMuted,
                    tabBarLabelStyle: {
                        fontSize: 10,
                        fontWeight: '700',
                        marginBottom: insets.bottom > 0 ? 0 : 4,
                    },
                }}
            >
                <Tab.Screen
                    name="Home"
                    component={HomeScreen}
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
                    }}
                />
                <Tab.Screen
                    name="Pet"
                    component={PetStatsScreen}
                    options={{
                        tabBarLabel: 'My Pet',
                        tabBarIcon: ({ focused }) => <TabIcon emoji="🐱" focused={focused} />,
                    }}
                />
                <Tab.Screen
                    name="Search"
                    component={OCRSearchScreen}
                    options={{
                        tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" focused={focused} />,
                    }}
                />
            </Tab.Navigator>

            {/* 🚀 THE AD / INFO STRIP 🚀 */}
            <View style={[styles.adStrip, { bottom: tabBarHeight }]}>
                <Text style={styles.adText}>🌟 NoteVibe Pro: Unlimited AI Summaries!</Text>
                <TouchableOpacity onPress={() => console.log('Ad Clicked')}>
                    <Text style={styles.adAction}>Upgrade ›</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

export default function AppNavigator() {
    return (
        <NavigationContainer>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                    <Stack.Screen name="StudyMode" component={StudyModeScreen} />
                    <Stack.Screen name="Organizer" component={OrganizerScreen} />
                    <Stack.Screen name="AICopilot" component={AICopilotScreen} />
                    <Stack.Screen name="OCRSearch" component={OCRSearchScreen} />
            </Stack.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    adStrip: {
        position: 'absolute',
        left: 0,
        right: 0,
        height: 34, // Small, sleek height
        backgroundColor: colors.purple || '#7C5CFF', // Using your theme purple
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 15,
        // Optional: slight border to separate it from the content
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.1)',
    },
    adText: {
        color: '#FFF',
        fontSize: 11,
        fontWeight: '700',
    },
    adAction: {
        color: colors.yellow,
        fontSize: 11,
        fontWeight: '800',
        marginLeft: 8,
    }
});