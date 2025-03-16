import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

// Composants personnalisés et constantes (adaptez selon votre projet)
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// Icône Material UI (compatible React Web)
import SettingsIcon from '@mui/icons-material/Settings';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: { position: 'absolute' },
          default: {},
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="paperplane.fill" color={color} />
          ),
        }}
      />

      {/* --- NOUVEL ONGLEt "CONFIG" --- */}
      <Tabs.Screen
        name="config"
        options={{
          title: 'Config',
          // On utilise l'icône Material UI "Settings" (web uniquement)
          tabBarIcon: ({ color }) => (
            <SettingsIcon style={{ color }} />
          ),
        }}
      />
    </Tabs>
  );
}
