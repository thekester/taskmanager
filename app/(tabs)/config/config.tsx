import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Button, Alert, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ConfigScreen() {
  const router = useRouter();

  const [alarm, setAlarm] = useState(false);
  const [notification, setNotification] = useState(true);
  const [autre, setAutre] = useState(false);

  // Charger la configuration sauvegardée au montage
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configStr = await AsyncStorage.getItem('userConfig');
        if (configStr) {
          const config = JSON.parse(configStr);
          setAlarm(config.alarm);
          setNotification(config.notification);
          setAutre(config.autre);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
      }
    };
    loadConfig();
  }, []);

  const saveConfig = async () => {
    const config = { alarm, notification, autre };
    try {
      await AsyncStorage.setItem('userConfig', JSON.stringify(config));
      Alert.alert(
        'Configuration des rappels',
        `Alarme: ${alarm ? 'Oui' : 'Non'}, Notification: ${notification ? 'Oui' : 'Non'}, Autre: ${autre ? 'Oui' : 'Non'}`
      );
      router.back();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la configuration:', error);
      Alert.alert('Erreur', "La configuration n'a pas pu être sauvegardée.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Configuration des Rappels</Text>
      <View style={styles.configRow}>
        <Text style={styles.configLabel}>Alarme</Text>
        <Switch value={alarm} onValueChange={setAlarm} />
      </View>
      <View style={styles.configRow}>
        <Text style={styles.configLabel}>Notification</Text>
        <Switch value={notification} onValueChange={setNotification} />
      </View>
      <View style={styles.configRow}>
        <Text style={styles.configLabel}>Autre</Text>
        <Switch value={autre} onValueChange={setAutre} />
      </View>
      <View style={styles.buttonRow}>
        <Button title="Annuler" onPress={() => router.back()} />
        <Button title="Sauvegarder" onPress={saveConfig} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 22, marginBottom: 20, fontWeight: 'bold', textAlign: 'center' },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  configLabel: { fontSize: 16 },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 40,
  },
});
