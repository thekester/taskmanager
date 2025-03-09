import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

// Composants personnalisés (à adapter selon ton projet)
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

// IMPORTANT : on importe directement le fichier SVG comme un composant React :
import LocationSvg from '../../assets/images/location.svg';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Couleur de l’icône/tab actif
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        // Masque le header par défaut
        headerShown: false,
        // Remplace la touche du tab par une version “haptique” (vibreur)
        tabBarButton: HapticTab,
        // Arrière-plan personnalisé pour la barre
        tabBarBackground: TabBarBackground,
        // Styles spécifiques par plateforme
        tabBarStyle: Platform.select({
          ios: {
            // Sur iOS, on peut rendre la barre "flottante"
            position: 'absolute',
          },
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

    </Tabs>
  );
}