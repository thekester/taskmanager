import React, { useState, useEffect } from 'react';
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

export default function ConfigScreen() {
  const router = useRouter();

  const [alarm, setAlarm] = useState(false);
  const [notification, setNotification] = useState(true);
  const [autre, setAutre] = useState(false);
  const [alarmOffset, setAlarmOffset] = useState('5'); // Valeur par défaut en minutes

  // Fonction de vérification et gestion de la permission d'alarmes sur Android
  const checkAndHandleAlarmPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        // On force la conversion pour satisfaire TypeScript
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
                  // Attendre quelques secondes puis re-vérifier
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


  // Vérifier la permission dès le montage
  useEffect(() => {
    checkAndHandleAlarmPermission();
  }, []);

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
          // On vérifie si un décalage a été défini, sinon on garde la valeur par défaut "5"
          setAlarmOffset(config.alarmOffset ? config.alarmOffset.toString() : '5');
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la configuration:', error);
      }
    };
    loadConfig();
  }, []);

  const saveConfig = async () => {
    // Conversion du décalage en entier (avec 5 comme valeur par défaut)
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
});
