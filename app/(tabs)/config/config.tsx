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
      <View style={styles.card}>
        <Text style={styles.title}>Configuration des Rappels</Text>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Alarme</Text>
          <Switch 
            value={alarm} 
            onValueChange={setAlarm} 
            trackColor={{ false: '#ccc', true: '#4CAF50' }}
            thumbColor={alarm ? '#fff' : '#f4f3f4'}
          />
        </View>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Notification</Text>
          <Switch 
            value={notification} 
            onValueChange={setNotification} 
            trackColor={{ false: '#ccc', true: '#2196F3' }}
            thumbColor={notification ? '#fff' : '#f4f3f4'}
          />
        </View>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Autre</Text>
          <Switch 
            value={autre} 
            onValueChange={setAutre} 
            trackColor={{ false: '#ccc', true: '#FF9800' }}
            thumbColor={autre ? '#fff' : '#f4f3f4'}
          />
        </View>
        <View style={styles.buttonRow}>
          <Button title="Annuler" onPress={() => router.back()} color="#E57373" />
          <Button title="Sauvegarder" onPress={saveConfig} color="#4CAF50" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25,
    textAlign: 'center',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  configLabel: {
    fontSize: 18,
    color: '#555',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
});
