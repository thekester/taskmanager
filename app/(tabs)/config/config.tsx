import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Switch,
  Button,
  Alert,
  StyleSheet,
  SafeAreaView,
  TextInput,
  PermissionsAndroid,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Picker } from '@react-native-picker/picker';

export default function ConfigScreen() {
  const router = useRouter();

  const [alarm, setAlarm] = useState(false);
  const [notification, setNotification] = useState(true);
  const [autre, setAutre] = useState(false);
  const [alarmOffset, setAlarmOffset] = useState('5'); // en minutes

  // États pour le téléchargement des marées (ou tuiles) et la sélection de région
  const [selectedRegion, setSelectedRegion] = useState('France');
  const [isDownloading, setIsDownloading] = useState(false);

  // Fonction de vérification et gestion de la permission d'alarmes sur Android (inchangée)
  const checkAndHandleAlarmPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(
          "android.permission.SCHEDULE_EXACT_ALARM" as any
        );
        if (!granted) {
          Alert.alert(
            "Permission d'Alarme manquante",
            "Vous n'avez pas la permission de définir des alarmes exactes. Voulez-vous ouvrir les paramètres pour l'activer ?",
            [
              {
                text: "Ouvrir les paramètres",
                onPress: async () => {
                  await Linking.openSettings();
                  setTimeout(async () => {
                    const newGranted = await PermissionsAndroid.check(
                      "android.permission.SCHEDULE_EXACT_ALARM" as any
                    );
                    if (!newGranted) {
                      Alert.alert(
                        "Droits non activés",
                        "Vous n'avez pas activé les droits d'alarme, donc aucune alarme ne sera planifiée."
                      );
                      setAlarm(false);
                    }
                  }, 3000);
                },
              },
              {
                text: "Annuler",
                style: 'cancel',
                onPress: () => {
                  Alert.alert(
                    "Droits non activés",
                    "Vous n'avez pas activé les droits d'alarme, donc aucune alarme ne sera planifiée."
                  );
                  setAlarm(false);
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de la permission SCHEDULE_EXACT_ALARM :', error);
      }
    }
  };

  useEffect(() => {
    checkAndHandleAlarmPermission();
  }, []);

  // Charger la configuration sauvegardée
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const configStr = await AsyncStorage.getItem('userConfig');
        if (configStr) {
          const config = JSON.parse(configStr);
          setAlarm(config.alarm);
          setNotification(config.notification);
          setAutre(config.autre);
          setAlarmOffset(config.alarmOffset ? config.alarmOffset.toString() : '5');
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
      }
    };
    loadConfig();
  }, []);

  const saveConfig = async () => {
    const config = { alarm, notification, autre, alarmOffset: parseInt(alarmOffset, 10) || 5 };
    try {
      await AsyncStorage.setItem('userConfig', JSON.stringify(config));
      Alert.alert(
        'Configuration des rappels',
        `Alarme: ${alarm ? 'Oui' : 'Non'}, Notification: ${notification ? 'Oui' : 'Non'}, Autre: ${autre ? 'Oui' : 'Non'}, Décalage: ${alarmOffset} minutes`
      );
      router.back();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de la configuration:', error);
      Alert.alert('Erreur', "La configuration n'a pas pu être sauvegardée.");
    }
  };

  // Fonction de téléchargement des tuiles hors-ligne
  // Ici, nous utilisons un exemple simplifié qui télécharge les tuiles pour une zone et un intervalle de zoom donnés.
  const downloadOfflineTiles = async () => {
    if (!('caches' in window)) {
      Alert.alert("Cache API non supportée", "Votre navigateur ne supporte pas la Cache API.");
      return;
    }
    // Définir les paramètres de la zone à télécharger
    const bounds = { // [minLng, minLat, maxLng, maxLat]
      minLng: -74.5,
      minLat: 40,
      maxLng: -73.5,
      maxLat: 41,
    };
    const minZoom = 2;
    const maxZoom = 4; // Par exemple, on télécharge de 2 à 4

    const tileUrlTemplate = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    let tileUrls: string[] = [];

    // Fonction utilitaire pour calculer les indices de tuiles (simplifiée)
    const long2tile = (lon: number, zoom: number) => Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    const lat2tile = (lat: number, zoom: number) => {
      const rad = lat * Math.PI / 180;
      return Math.floor((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * Math.pow(2, zoom));
    };

    for (let z = minZoom; z <= maxZoom; z++) {
      const xMin = long2tile(bounds.minLng, z);
      const xMax = long2tile(bounds.maxLng, z);
      const yMin = lat2tile(bounds.maxLat, z); // Notez que pour latitude, l'ordre s'inverse
      const yMax = lat2tile(bounds.minLat, z);
      for (let x = xMin; x <= xMax; x++) {
        for (let y = yMin; y <= yMax; y++) {
          const url = tileUrlTemplate.replace('{z}', z.toString()).replace('{x}', x.toString()).replace('{y}', y.toString());
          tileUrls.push(url);
        }
      }
    }

    try {
      const cacheName = 'offline-tiles';
      const cache = await caches.open(cacheName);
      let downloaded = 0;
      for (const url of tileUrls) {
        try {
          const response = await fetch(url);
          if (response.ok) {
            await cache.put(url, response);
            downloaded++;
          }
        } catch (err) {
          console.error('Erreur lors du téléchargement de', url, err);
        }
      }
      Alert.alert("Téléchargement terminé", `${downloaded} tuiles ont été téléchargées et mises en cache.`);
    } catch (error) {
      console.error('Erreur lors du téléchargement des tuiles hors-ligne :', error);
      Alert.alert("Erreur", "Le téléchargement des tuiles hors-ligne a échoué.");
    }
  };

  // Pour cet exemple, nous gardons le reste de votre code inchangé (gestion des notifications, des tâches, etc.)
  // ...

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Configuration des Rappels</Text>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Alarme</Text>
          <Switch 
            value={alarm} 
            onValueChange={(value) => {
              setAlarm(value);
              if (value) {
                checkAndHandleAlarmPermission();
              }
            }} 
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
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Décalage d'Alarme (min)</Text>
          <TextInput
            style={styles.textInput}
            value={alarmOffset}
            onChangeText={setAlarmOffset}
            keyboardType="numeric"
            placeholder="Minutes"
          />
        </View>

        {/* Section hors-ligne : téléchargement des tuiles */}
        {Platform.OS === 'web' && (
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>Tuiles hors-ligne</Text>
            <Button
              title={isDownloading ? "Téléchargement en cours..." : "Télécharger les tuiles hors-ligne"}
              onPress={downloadOfflineTiles}
              disabled={isDownloading}
            />
          </View>
        )}

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
  configRowColumn: {
    flexDirection: 'column',
    width: '100%',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  configLabel: {
    fontSize: 18,
    color: '#555',
  },
  textInput: {
    height: 40,
    width: 100,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    textAlign: 'center',
    backgroundColor: '#f9f9f9',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 30,
  },
  mapSection: {
    marginTop: 20,
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
});
