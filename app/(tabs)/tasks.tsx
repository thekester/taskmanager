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
      console.log('[MapboxGLJSSelector] useEffect web -> init map');
      function initializeMap() {
        if (window.mapboxgl && containerRef.current) {
          console.log('[MapboxGLJSSelector] initializeMap -> mapboxgl found');
          window.mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
          const map = new window.mapboxgl.Map({
            container: containerRef.current,
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-74.5, 40],
            zoom: 9,
          });
          map.addControl(new window.mapboxgl.NavigationControl());
          map.on('load', () => {
            console.log('[MapboxGLJSSelector] Map loaded (web).');
            if (window.MapboxSearchBox) {
              console.log('[MapboxGLJSSelector] MapboxSearchBox found, adding search control');
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
            console.log('[MapboxGLJSSelector] Map clicked:', lngLat);
            onLocationSelect([lngLat.lng, lngLat.lat]);
          });
        } else {
          console.log('[MapboxGLJSSelector] window.mapboxgl not found or containerRef is null');
        }
      }
      if (!document.getElementById('mapbox-gl-css')) {
        console.log('[MapboxGLJSSelector] injecting mapbox-gl CSS');
        const link = document.createElement('link');
        link.id = 'mapbox-gl-css';
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css';
        document.head.appendChild(link);
      }
      if (!document.getElementById('mapbox-gl-js')) {
        console.log('[MapboxGLJSSelector] injecting mapbox-gl JS');
        const script = document.createElement('script');
        script.id = 'mapbox-gl-js';
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js';
        script.async = true;
        script.onload = () => {
          console.log('[MapboxGLJSSelector] mapbox-gl JS loaded');
          if (!document.getElementById('search-js')) {
            console.log('[MapboxGLJSSelector] injecting search-js');
            const searchScript = document.createElement('script');
            searchScript.id = 'search-js';
            searchScript.defer = true;
            searchScript.src = 'https://api.mapbox.com/search-js/v1.0.0/web.js';
            document.body.appendChild(searchScript);
            searchScript.onload = () => {
              console.log('[MapboxGLJSSelector] search-js loaded -> initializeMap()');
              initializeMap();
            };
          } else {
            initializeMap();
          }
        };
        document.body.appendChild(script);
      } else {
        console.log('[MapboxGLJSSelector] mapbox-gl JS already present -> initializeMap()');
        initializeMap();
      }
    }, [MAPBOX_ACCESS_TOKEN, onLocationSelect]);
    return <div ref={containerRef} style={{ height: '300px', marginTop: '10px', marginBottom: '10px' }} />;
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
      console.log('[Mobile HTML] Map script start');
      mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [-74.5, 40],
        zoom: 9
      });
      map.addControl(new mapboxgl.NavigationControl());
      map.on('load', () => {
        console.log('[Mobile HTML] map loaded');
        if (typeof MapboxSearchBox !== 'undefined') {
          console.log('[Mobile HTML] MapboxSearchBox found, adding it');
          const searchBox = new MapboxSearchBox();
          searchBox.accessToken = mapboxgl.accessToken;
          searchBox.options = {
            types: 'address,poi',
            proximity: [-74.0066, 40.7135]
          };
          searchBox.marker = true;
          searchBox.mapboxgl = mapboxgl;
          map.addControl(searchBox);
        } else {
          console.log('[Mobile HTML] MapboxSearchBox not found');
        }
      });
      map.on('click', (e) => {
        const lngLat = e.lngLat;
        console.log('[Mobile HTML] Map clicked', lngLat);
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
              console.log('[MapboxGLJSSelector] Received coords from mobile:', data);
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
  container: { height: 300, marginTop: 10, marginBottom: 10 },
  webview: { flex: 1 },
});

// ===========================
// Tâches Screen principal
// ===========================
export default function TasksScreen() {
  console.log('[TasksScreen] RENDER');

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

  // Récupération des query params : editTaskId et openModal
  const { editTaskId, openModal } = useLocalSearchParams();
  const router = useRouter();

  console.log('[TasksScreen] editTaskId =', editTaskId);
  console.log('[TasksScreen] openModal =', openModal);

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
      console.log('[TasksScreen] Statut des notifications:', status);
    }
    checkNotifPermissions();
  }, []);

  const handleActivateNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setNotifStatus(status);
    console.log('[TasksScreen] handleActivateNotifications status:', status);
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
          console.log('[TasksScreen] Config utilisateur chargée:', config);
        } else {
          console.log('[TasksScreen] Aucune config utilisateur trouvée.');
        }
      } catch (error) {
        console.error('Erreur lors du chargement de la config utilisateur', error);
      }
    };
    loadUserConfig();
  }, []);

  useEffect(() => {
    console.log('[TasksScreen] useEffect -> create table + load tasks');
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, date TEXT, location TEXT, distance TEXT, category TEXT);',
          [],
          () => {
            console.log('[TasksScreen] Table tasks créée.');
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
    console.log('[TasksScreen] loadTasks called');
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
            console.log('[TasksScreen] tasks loaded from SQLite:', loadedTasks);
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
        console.log('[TasksScreen] tasks loaded from localStorage:', parsed);
        setTasks(parsed);
      } else {
        console.log('[TasksScreen] no tasks in localStorage');
      }
    }
  };

  useEffect(() => {
    console.log('[TasksScreen] useEffect -> checking editTaskId and tasks');
    console.log('[TasksScreen] tasks =', tasks);
    if (editTaskId) {
      console.log('[TasksScreen] we have editTaskId:', editTaskId);
      const found = tasks.find((t) => t.id.toString() === editTaskId.toString());
      console.log('[TasksScreen] found task =', found);
      if (found) {
        console.log('[TasksScreen] opening modal for found task:', found);
        setTaskInput(found.task);
        setDate(new Date(found.date));
        setLocation(found.location || '');
        setDistance(found.distance || '');
        setCategory(found.category || 'Travail');
        setEditingTaskId(found.id.toString());
        setModalVisible(true);
      } else {
        console.log('[TasksScreen] no matching task found for editTaskId');
      }
    } else {
      console.log('[TasksScreen] no editTaskId -> do nothing');
    }
  }, [editTaskId, tasks]);

  const saveTasksToAsyncStorage = async (updatedTasks: Task[]): Promise<void> => {
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
      console.log('[TasksScreen] saved tasks to AsyncStorage:', updatedTasks);
    } catch (error) {
      console.error('Error saving tasks to AsyncStorage:', error);
    }
  };

  const closeModal = (): void => {
    console.log('[TasksScreen] closeModal called');
    setModalVisible(false);
    setEditingTaskId(null);
    router.replace('/tasks');
  };

  const handleSaveTask = (): void => {
    console.log('[TasksScreen] handleSaveTask called');
    const dateString = date.toISOString();
    if (!taskInput || !dateString) {
      Alert.alert('Erreur', 'Veuillez remplir au moins le titre et la date.');
      return;
    }
    const triggerNotification = (newTask: Task) => {
      maybeScheduleNotification(newTask);
    };

    if (editingTaskId) {
      console.log('[TasksScreen] update existing task, id=', editingTaskId);
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'UPDATE tasks SET task=?, date=?, location=?, distance=?, category=? WHERE id=?;',
            [taskInput, dateString, location, distance, category, editingTaskId],
            () => {
              console.log('[TasksScreen] updated task in SQLite -> reloading tasks');
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
      console.log('[TasksScreen] create new task');
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'INSERT INTO tasks (task, date, location, distance, category) VALUES (?,?,?,?,?);',
            [taskInput, dateString, location, distance, category],
            (tx: any, result: any) => {
              console.log('[TasksScreen] Task added successfully in SQLite with id:', result.insertId);
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
    console.log('[TasksScreen] handleDeleteTask -> id=', id);
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'DELETE FROM tasks WHERE id=?;',
          [id],
          () => {
            console.log('[TasksScreen] deleted task in SQLite -> reloading tasks');
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
    console.log('[TasksScreen] handleEditTask -> id=', id);
    const taskToEdit = tasks.find((t) => t.id === id);
    if (taskToEdit) {
      console.log('[TasksScreen] editing found task =', taskToEdit);
      setTaskInput(taskToEdit.task);
      setDate(new Date(taskToEdit.date));
      setLocation(taskToEdit.location || '');
      setDistance(taskToEdit.distance || '');
      setCategory(taskToEdit.category || 'Travail');
      setEditingTaskId(id.toString());
      setModalVisible(true);
    } else {
      console.log('[TasksScreen] no task found for id=', id);
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
      <Text style={styles.taskText}>Tâche: {item.task}</Text>
      <Text style={styles.taskText}>Date: {item.date}</Text>
      {item.location ? <Text style={styles.taskText}>Lieu: {item.location}</Text> : null}
      {item.distance ? <Text style={styles.taskText}>Distance: {item.distance}m</Text> : null}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.editButton} onPress={() => handleEditTask(item.id)}>
          <Text style={styles.editButtonText}>Modifier</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteTask(item.id)}>
          <Text style={styles.deleteButtonText}>Supprimer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Gestion des Tâches</Text>
      <View style={styles.notifContainer}>
        <Text style={styles.notifStatusText}>
          Notifications : {notifStatus || 'inconnu'}
        </Text>
        {notifStatus !== 'granted' && (
          <Button title="Activate Notifications" onPress={handleActivateNotifications} />
        )}
      </View>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          console.log('[TasksScreen] "Create new Task" button pressed');
          setModalVisible(true);
          setEditingTaskId(null);
          setTaskInput('');
          setDate(new Date());
          setLocation('');
          setDistance('');
          setCategory('Travail');
        }}
      >
        <Text style={styles.addButtonText}>+ Create a new Task</Text>
      </TouchableOpacity>
      <SectionList
        sections={sortTasksByCategory()}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTaskItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
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
              onChangeText={(text) => {
                console.log('[TasksScreen] setTaskInput ->', text);
                setTaskInput(text);
              }}
            />
            {Platform.OS === 'web' ? (
              <WebDatePicker
                selected={date}
                onChange={(selectedDate: Date) => {
                  console.log('[TasksScreen] Date changed (web) ->', selectedDate);
                  setDate(selectedDate);
                }}
                showTimeSelect
                timeFormat="HH:mm"
                timeIntervals={15}
                dateFormat="yyyy-MM-dd HH:mm"
                timeCaption="Heure"
              />
            ) : (
              <DatePickerMobile
                date={date}
                onDateChange={(newDate: Date) => {
                  console.log('[TasksScreen] Date changed (mobile) ->', newDate);
                  setDate(newDate);
                }}
                mode="datetime"
              />
            )}
            <TextInput
              style={styles.modalInput}
              placeholder="Emplacement (optionnel)"
              value={location}
              onChangeText={(text) => {
                console.log('[TasksScreen] setLocation ->', text);
                setLocation(text);
              }}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Distance (optionnel)"
              value={distance}
              onChangeText={(text) => {
                console.log('[TasksScreen] setDistance ->', text);
                setDistance(text);
              }}
              keyboardType="numeric"
            />
            <Picker
              selectedValue={category}
              style={styles.picker}
              onValueChange={(itemValue: string) => {
                console.log('[TasksScreen] setCategory ->', itemValue);
                setCategory(itemValue);
              }}
            >
              <Picker.Item label="Travail" value="Travail" />
              <Picker.Item label="Famille" value="Famille" />
              <Picker.Item label="Divers" value="Divers" />
            </Picker>
            <MapboxGLJSSelector
              onLocationSelect={(coords: number[]) => {
                console.log('[TasksScreen] onLocationSelect from Mapbox ->', coords);
                setLocation(JSON.stringify(coords));
              }}
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

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f0f0f0' },
  notifContainer: { padding: 10, backgroundColor: '#eee', alignItems: 'center' },
  notifStatusText: { fontSize: 16, marginBottom: 5 },
  header: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginTop: 20, marginBottom: 20 },
  addButton: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  addButtonText: { color: '#fff', fontSize: 18 },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', backgroundColor: '#eee', padding: 5, marginTop: 15 },
  taskItem: { backgroundColor: '#fff', padding: 15, borderRadius: 8, borderWidth: 1, borderColor: '#ccc', marginBottom: 10 },
  taskText: { fontSize: 16, marginBottom: 5 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  editButton: { flex: 0.48, padding: 10, backgroundColor: 'orange', borderRadius: 5, alignItems: 'center' },
  editButtonText: { color: '#fff', fontSize: 16 },
  deleteButton: { flex: 0.48, padding: 10, backgroundColor: 'red', borderRadius: 5, alignItems: 'center' },
  deleteButtonText: { color: '#fff', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { width: '90%', backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 24, fontWeight: '700', marginBottom: 15, textAlign: 'center', color: '#333' },
  modalInput: { backgroundColor: '#f9f9f9', height: 45, borderColor: '#ddd', borderWidth: 1, borderRadius: 8, marginBottom: 15, paddingHorizontal: 15 },
  picker: { height: 50, width: '100%', marginBottom: 15 },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  modalButton: { flex: 1, backgroundColor: '#4CAF50', paddingVertical: 12, borderRadius: 8, marginHorizontal: 5, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F44336' },
  modalButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
