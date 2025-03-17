import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SectionList,
  Platform,
  TextInput,
  Linking,
  Button,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import SQLite from 'react-native-sqlite-storage';
import { WebView } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useLocalSearchParams, useRouter } from 'expo-router';

// ***** Date pickers (web vs mobile) *****
let WebDatePicker: any = null;
if (Platform.OS === 'web') {
  WebDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
} else {
  var DatePickerMobile = require('react-native-date-picker').default;
}

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Pour les notifications natives
async function registerForPushNotificationsAsync(): Promise<void> {
  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      Alert.alert('Permission requise', 'Impossible d’obtenir l’autorisation pour les notifications push.');
      return;
    }
  } else {
    Alert.alert('Attention', 'Les notifications push nécessitent un appareil physique.');
  }
}

// Définition de l'interface Task
interface Task {
  id: string | number;
  task: string;
  date: string;
  location?: string;
  distance?: string;
  category: string;
}

// Nouvelle fonction pour planifier un rappel de tâche avec décalage personnalisé (pour mobile)
async function scheduleTaskReminder(task: Task, offsetMinutes: number): Promise<void> {
  const taskDate = new Date(task.date);
  const now = new Date();
  const offset = offsetMinutes * 60 * 1000;
  const triggerTime = taskDate.getTime() - offset;
  const delaySeconds = Math.max(Math.floor((triggerTime - now.getTime()) / 1000), 1);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rappel de tâche',
        body: `N'oublie pas : ${task.task}`,
        data: { taskId: task.id },
      },
      trigger: { seconds: delaySeconds, repeats: false } as Notifications.TimeIntervalTriggerInput,
    });
    console.log('[scheduleTaskReminder] Notification planifiée dans', delaySeconds, 'secondes');
  } catch (error) {
    console.error('[scheduleTaskReminder] Erreur lors de la planification de la notification:', error);
  }
}

// Pour le web, avec setTimeout (solution valable tant que la page reste ouverte)
function scheduleTaskReminderWeb(task: Task, offsetMinutes: number): void {
  const taskDate = new Date(task.date);
  const now = new Date();
  const offset = offsetMinutes * 60 * 1000;
  const triggerTime = taskDate.getTime() - offset;
  const delay = Math.max(triggerTime - now.getTime(), 0);
  console.log('[scheduleTaskReminderWeb] Planification d\'un rappel dans', delay, 'ms');
  setTimeout(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('Rappel de tâche', {
          body: `N'oublie pas : ${task.task}`,
        });
      }
    }
  }, delay);
}

// Fonction hybride pour planifier la notification de rappel en fonction de la config utilisateur
const maybeScheduleNotification = async (task: Task): Promise<void> => {
  try {
    const configStr = await AsyncStorage.getItem('userConfig');
    const config = configStr ? JSON.parse(configStr) : null;
    console.log('[TasksScreen] Config chargée dans maybeScheduleNotification:', config);
    if (config?.notification && config?.alarm) {
      if (Platform.OS !== 'web') {
        scheduleTaskReminder(task, config.alarmOffset);
      } else {
        scheduleTaskReminderWeb(task, config.alarmOffset);
      }
    } else {
      console.log('[TasksScreen] Notifications ou alarmes désactivées, aucun rappel planifié.');
    }
  } catch (error) {
    console.error('[TasksScreen] Erreur lors du rechargement de la config:', error);
  }
};

// ***** SQLite si pas sur web *****
let db: any = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabase({ name: 'tasks.db', location: 'default' });
}

// ***** Composant MapboxGLJSSelector *****
interface MapboxGLJSSelectorProps {
  onLocationSelect: (coords: number[]) => void;
}

const MapboxGLJSSelector: React.FC<MapboxGLJSSelectorProps> = ({ onLocationSelect }) => {
  const MAPBOX_ACCESS_TOKEN =
    'pk.eyJ1IjoibWFwcHltYWFuaWFjIiwiYSI6ImNtODFuZ3AxejEyZmUycnM1MHFpazN0OXQifQ.Y_6RTH2rn8M1QOgSHEQhJg';

  if (Platform.OS === 'web') {
    const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      function initializeMap() {
        if (window.mapboxgl && containerRef.current) {
          window.mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
          const map = new window.mapboxgl.Map({
            container: containerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-74.5, 40],
            zoom: 9,
          });
          map.addControl(new window.mapboxgl.NavigationControl());
          map.on('load', () => {
            if (window.MapboxSearchBox) {
              const searchBox = new window.MapboxSearchBox();
              searchBox.accessToken = window.mapboxgl.accessToken;
              searchBox.options = {
                types: 'address,poi',
                proximity: [-74.0066, 40.7135],
              };
              searchBox.marker = true;
              searchBox.mapboxgl = window.mapboxgl;
              map.addControl(searchBox);
            }
          });
          map.on('click', (e: any) => {
            const lngLat = e.lngLat;
            onLocationSelect([lngLat.lng, lngLat.lat]);
          });
        }
      }
      if (!document.getElementById('mapbox-gl-css')) {
        const link = document.createElement('link');
        link.id = 'mapbox-gl-css';
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('mapbox-gl-js')) {
        const script = document.createElement('script');
        script.id = 'mapbox-gl-js';
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js';
        script.async = true;
        script.onload = () => {
          if (!document.getElementById('search-js')) {
            const searchScript = document.createElement('script');
            searchScript.id = 'search-js';
            searchScript.defer = true;
            searchScript.src = 'https://api.mapbox.com/search-js/v1.0.0/web.js';
            document.body.appendChild(searchScript);
            searchScript.onload = initializeMap;
          } else {
            initializeMap();
          }
        };
        document.body.appendChild(script);
      } else {
        initializeMap();
      }
    }, [MAPBOX_ACCESS_TOKEN, onLocationSelect]);
    return <div ref={containerRef} style={{ height: '300px', marginVertical: 10 }} />;
  } else {
    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Mapbox GL JS Selector</title>
    <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no">
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css" rel="stylesheet">
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js"></script>
    <script id="search-js" defer src="https://api.mapbox.com/search-js/v1.0.0/web.js"></script>
    <style>
      body { margin: 0; padding: 0; }
      #map { position: absolute; top: 0; bottom: 0; width: 100%; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-74.5, 40],
        zoom: 9
      });
      map.addControl(new mapboxgl.NavigationControl());
      map.on('load', () => {
        if (typeof MapboxSearchBox !== 'undefined') {
          const searchBox = new MapboxSearchBox();
          searchBox.accessToken = mapboxgl.accessToken;
          searchBox.options = {
            types: 'address,poi',
            proximity: [-74.0066, 40.7135]
          };
          searchBox.marker = true;
          searchBox.mapboxgl = mapboxgl;
          map.addControl(searchBox);
        }
      });
      map.on('click', (e) => {
        const lngLat = e.lngLat;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          longitude: lngLat.lng,
          latitude: lngLat.lat
        }));
      });
    </script>
  </body>
</html>
    `;
    return (
      <View style={selectorStyles.container}>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={selectorStyles.webview}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              onLocationSelect([data.longitude, data.latitude]);
            } catch (err) {
              console.error('Error parsing message from WebView:', err);
            }
          }}
        />
      </View>
    );
  }
};

const selectorStyles = StyleSheet.create({
  container: { height: 300, marginVertical: 10 },
  webview: { flex: 1 },
});

// ===========================
// Tâches Screen principal
// ===========================
export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [date, setDate] = useState<Date>(new Date());
  const [taskInput, setTaskInput] = useState('');
  const [location, setLocation] = useState('');
  const [distance, setDistance] = useState('');
  const [category, setCategory] = useState('Travail');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);
  const [userConfig, setUserConfig] = useState<{ alarm: boolean; notification: boolean; autre: boolean; alarmOffset: number } | null>(null);

  const { editTaskId, openModal } = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (openModal === 'true') {
      setModalVisible(true);
    }
  }, [openModal]);

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    async function checkNotifPermissions() {
      const { status } = await Notifications.getPermissionsAsync();
      setNotifStatus(status);
    }
    checkNotifPermissions();
  }, []);

  const handleActivateNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status);
    if (status !== 'granted') {
      Alert.alert(
        "Permission non accordée",
        "Pour activer les notifications, veuillez vous rendre dans les paramètres.",
        [
          { text: "Ouvrir les paramètres", onPress: () => Linking.openSettings() },
          { text: "Annuler", style: 'cancel' }
        ]
      );
    }
  };

  useEffect(() => {
    const loadUserConfig = async () => {
      try {
        const configStr = await AsyncStorage.getItem('userConfig');
        if (configStr) {
          const config = JSON.parse(configStr);
          setUserConfig(config);
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la config utilisateur', error);
      }
    };
    loadUserConfig();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, date TEXT, location TEXT, distance TEXT, category TEXT);',
          [],
          () => {
            loadTasks();
          },
          (error: any) => console.log('Error creating table:', error)
        );
      });
    } else {
      loadTasks();
    }
  }, []);

  const loadTasks = (): void => {
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'SELECT * FROM tasks;',
          [],
          (_: any, results: any) => {
            const loadedTasks: Task[] = [];
            for (let i = 0; i < results.rows.length; i++) {
              loadedTasks.push(results.rows.item(i));
            }
            setTasks(loadedTasks);
            try {
              AsyncStorage.setItem('tasks', JSON.stringify(loadedTasks));
            } catch (e) {
              console.error('Error syncing with AsyncStorage', e);
            }
          },
          (error: any) => console.log('Error loading tasks:', error)
        );
      });
    } else {
      const tasksStr = localStorage.getItem('tasks');
      if (tasksStr) {
        const parsed = JSON.parse(tasksStr);
        setTasks(parsed);
      }
    }
  };

  useEffect(() => {
    if (editTaskId) {
      const found = tasks.find((t) => t.id.toString() === editTaskId.toString());
      if (found) {
        setTaskInput(found.task);
        setDate(new Date(found.date));
        setLocation(found.location || '');
        setDistance(found.distance || '');
        setCategory(found.category || 'Travail');
        setEditingTaskId(found.id.toString());
        setModalVisible(true);
      }
    }
  }, [editTaskId, tasks]);

  const saveTasksToAsyncStorage = async (updatedTasks: Task[]): Promise<void> => {
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.error('Error saving tasks to AsyncStorage:', error);
    }
  };

  const closeModal = (): void => {
    setModalVisible(false);
    setEditingTaskId(null);
    router.replace('/tasks');
  };

  const handleSaveTask = (): void => {
    const dateString = date.toISOString();
    if (!taskInput || !dateString) {
      Alert.alert('Erreur', 'Veuillez remplir au moins le titre et la date.');
      return;
    }
    const triggerNotification = (newTask: Task) => {
      maybeScheduleNotification(newTask);
    };

    if (editingTaskId) {
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'UPDATE tasks SET task=?, date=?, location=?, distance=?, category=? WHERE id=?;',
            [taskInput, dateString, location, distance, category, editingTaskId],
            () => {
              loadTasks();
              const updatedTask: Task = {
                id: editingTaskId,
                task: taskInput,
                date: dateString,
                location,
                distance,
                category,
              };
              triggerNotification(updatedTask);
            },
            (error: any) => console.log('Error updating task in SQLite:', error)
          );
        });
      } else {
        const updatedTasks = tasks.map((t) =>
          t.id === editingTaskId
            ? { ...t, task: taskInput, date: dateString, location, distance, category }
            : t
        );
        setTasks(updatedTasks);
        saveTasksToAsyncStorage(updatedTasks);
        const updatedTask = updatedTasks.find((t) => t.id.toString() === editingTaskId);
        if (updatedTask) triggerNotification(updatedTask);
      }
      setEditingTaskId(null);
    } else {
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'INSERT INTO tasks (task, date, location, distance, category) VALUES (?,?,?,?,?);',
            [taskInput, dateString, location, distance, category],
            (tx: any, result: any) => {
              loadTasks();
              const newTask: Task = {
                id: result.insertId,
                task: taskInput,
                date: dateString,
                location,
                distance,
                category,
              };
              triggerNotification(newTask);
            },
            (error: any) => console.log("Erreur lors de l'insertion:", error)
          );
        });
      } else {
        const newTask: Task = {
          id: Math.floor(Math.random() * 100000).toString(),
          task: taskInput,
          date: dateString,
          location,
          distance,
          category,
        };
        const updatedTasks = [...tasks, newTask];
        setTasks(updatedTasks);
        saveTasksToAsyncStorage(updatedTasks);
        triggerNotification(newTask);
      }
    }
    setTaskInput('');
    setDate(new Date());
    setLocation('');
    setDistance('');
    setCategory('Travail');
    closeModal();
  };

  const handleDeleteTask = (id: string | number): void => {
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'DELETE FROM tasks WHERE id=?;',
          [id],
          () => {
            loadTasks();
          },
          (error: any) => console.log('Error deleting task from SQLite:', error)
        );
      });
    } else {
      const updatedTasks = tasks.filter((t) => t.id !== id);
      setTasks(updatedTasks);
      saveTasksToAsyncStorage(updatedTasks);
    }
  };

  const handleEditTask = (id: string | number): void => {
    const taskToEdit = tasks.find((t) => t.id === id);
    if (taskToEdit) {
      setTaskInput(taskToEdit.task);
      setDate(new Date(taskToEdit.date));
      setLocation(taskToEdit.location || '');
      setDistance(taskToEdit.distance || '');
      setCategory(taskToEdit.category || 'Travail');
      setEditingTaskId(id.toString());
      setModalVisible(true);
    }
  };

  const sortTasksByCategory = (): { title: string; data: Task[] }[] => {
    const sorted: { [key: string]: Task[] } = {};
    tasks.forEach((t) => {
      const cat = t.category || 'Sans catégorie';
      if (!sorted[cat]) {
        sorted[cat] = [];
      }
      sorted[cat].push(t);
    });
    return Object.keys(sorted).map((cat) => ({
      title: cat,
      data: sorted[cat],
    }));
  };

  const renderTaskItem = ({ item }: { item: Task }) => (
    <View style={styles.taskItem}>
      <Text style={styles.taskTitle}>{item.task}</Text>
      <Text style={styles.taskDetail}>Date : {new Date(item.date).toLocaleString()}</Text>
      {item.location ? <Text style={styles.taskDetail}>Lieu : {item.location}</Text> : null}
      {item.distance ? <Text style={styles.taskDetail}>Distance : {item.distance} m</Text> : null}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.editButton} onPress={() => handleEditTask(item.id)}>
          <Text style={styles.buttonText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteTask(item.id)}>
          <Text style={styles.buttonText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Gestion des Tâches</Text>
      <View style={styles.notifContainer}>
        <Text style={styles.notifText}>Notifications : {notifStatus || 'inconnu'}</Text>
        {notifStatus !== 'granted' && (
          <Button title="Activer" onPress={handleActivateNotifications} />
        )}
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setModalVisible(true);
          setEditingTaskId(null);
          setTaskInput('');
          setDate(new Date());
          setLocation('');
          setDistance('');
          setCategory('Travail');
        }}
      >
        <Text style={styles.addButtonText}>+ Nouvelle Tâche</Text>
      </TouchableOpacity>
      <SectionList
        sections={sortTasksByCategory()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTaskItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        contentContainerStyle={styles.listContent}
      />
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>
              {editingTaskId ? 'Modifier la tâche' : 'Nouvelle Tâche'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Titre de la tâche"
              value={taskInput}
              onChangeText={setTaskInput}
            />
            {Platform.OS === 'web' ? (
              <WebDatePicker
                selected={date}
                onChange={(selectedDate: Date) => setDate(selectedDate)}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy-MM-dd HH:mm"
                timeCaption="Heure"
              />
            ) : (
              <DatePickerMobile
                date={date}
                onDateChange={setDate}
                mode="datetime"
              />
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Emplacement (optionnel)"
              value={location}
              onChangeText={setLocation}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Distance (optionnel)"
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
            />
            <Picker
              selectedValue={category}
              style={styles.picker}
              onValueChange={(itemValue: string) => setCategory(itemValue)}
            >
              <Picker.Item label="Travail" value="Travail" />
              <Picker.Item label="Famille" value="Famille" />
              <Picker.Item label="Divers" value="Divers" />
            </Picker>
            <MapboxGLJSSelector
              onLocationSelect={(coords: number[]) => setLocation(JSON.stringify(coords))}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveTask}>
                <Text style={styles.modalButtonText}>
                  {editingTaskId ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeModal}>
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const basePadding = 16;
const styles = StyleSheet.create({
  container: { flex: 1, padding: basePadding, backgroundColor: '#EFEFEF' },
  header: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginVertical: basePadding },
  notifContainer: {
    backgroundColor: '#fff',
    padding: basePadding / 2,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: basePadding,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  notifText: { fontSize: 16, color: '#333' },
  addButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: basePadding,
  },
  addButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  sectionHeader: {
    backgroundColor: '#dfe6e9',
    paddingVertical: 8,
    paddingHorizontal: basePadding,
    fontSize: 18,
    fontWeight: '600',
    marginTop: basePadding / 2,
  },
  listContent: { paddingBottom: basePadding },
  taskItem: {
    backgroundColor: '#fff',
    padding: basePadding,
    borderRadius: 10,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  taskTitle: { fontSize: 18, fontWeight: 'bold', color: '#2d3436' },
  taskDetail: { fontSize: 14, color: '#636e72', marginVertical: 2 },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: basePadding / 2,
  },
  editButton: {
    flex: 0.48,
    backgroundColor: 'orange',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 0.48,
    backgroundColor: '#E74C3C',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '500' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: basePadding,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: basePadding,
    textAlign: 'center',
    color: '#333',
  },
  modalInput: {
    backgroundColor: '#f9f9f9',
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: basePadding,
    paddingHorizontal: basePadding,
  },
  picker: { height: 50, width: '100%', marginBottom: basePadding },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: basePadding,
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: '#E74C3C' },
  modalButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
