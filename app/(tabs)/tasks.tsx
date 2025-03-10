import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  Modal,
  SectionList,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import SQLite from 'react-native-sqlite-storage';
import { WebView } from 'react-native-webview';

// For web, import react-datepicker and its CSS.
let WebDatePicker: any = null;
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
}

// For mobile (Android/iOS), import react-native-date-picker.
import DatePickerMobile from 'react-native-date-picker';

interface Task {
  id: string | number;
  task: string;
  date: string;
  location?: string; // JSON string representing a tuple [longitude, latitude]
  distance?: string;
  category: string;
}

let db: any = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabase({ name: 'tasks.db', location: 'default' });
}

/**
 * MapboxGLJSSelector Component
 *
 * On mobile platforms it uses a WebView.
 * On web platforms, it injects Mapbox CSS and JS via a useEffect hook and initializes the map
 * in a referenced div container. Clicking on the map updates the selected location without refreshing the map.
 */
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
            searchScript.onload = () => initializeMap();
          } else {
            initializeMap();
          }
        };
        document.body.appendChild(script);
      } else {
        initializeMap();
      }
    }, [MAPBOX_ACCESS_TOKEN, onLocationSelect]);

    return (
      <div
        ref={containerRef}
        style={{ height: 300, marginTop: 10, marginBottom: 10 }}
      />
    );
  }

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
      map.on('click', (e) => {
        const lngLat = e.lngLat;
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({
          longitude: lngLat.lng,
          latitude: lngLat.lat
        }));
      });
      map.on('load', () => {
        const searchBox = new MapboxSearchBox();
        searchBox.accessToken = mapboxgl.accessToken;
        searchBox.options = {
          types: 'address,poi',
          proximity: [-74.0066, 40.7135]
        };
        searchBox.marker = true;
        searchBox.mapboxgl = mapboxgl;
        map.addControl(searchBox);
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
};

const selectorStyles = StyleSheet.create({
  container: {
    height: 300,
    marginTop: 10,
    marginBottom: 10,
  },
  webview: {
    flex: 1,
  },
});

const TaskManagerScreen: React.FC = () => {
  // Use one Date state for both platforms.
  const [date, setDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [location, setLocation] = useState('');
  const [distance, setDistance] = useState('');
  const [category, setCategory] = useState('Travail');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [locationCoords, setLocationCoords] = useState<number[] | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, task TEXT, date TEXT, location TEXT, distance TEXT, category TEXT);',
          [],
          () => loadTasks(),
          (error: any) => console.log('Error creating table:', error)
        );
      });
    } else {
      loadTasks();
    }
  }, []);

  const loadTasks = () => {
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
      if (tasksStr) setTasks(JSON.parse(tasksStr));
    }
  };

  const saveTasksToAsyncStorage = async (updatedTasks: Task[]) => {
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.error('Error saving tasks to AsyncStorage:', error);
    }
  };

  const handleSaveTask = () => {
    // Convert the Date object to YYYY-MM-DD string.
    const dateString = date.toISOString().slice(0, 10);

    if (!taskInput || !dateString) {
      Alert.alert('Erreur', 'Veuillez remplir au moins le titre et la date.');
      return;
    }
    if (editingTaskId) {
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'UPDATE tasks SET task=?, date=?, location=?, distance=?, category=? WHERE id=?;',
            [taskInput, dateString, location, distance, category, editingTaskId],
            () => loadTasks(),
            (error: any) => console.log('Error updating task in SQLite:', error)
          );
        });
      } else {
        const updatedTasks = tasks.map((t) =>
          t.id === editingTaskId ? { ...t, task: taskInput, date: dateString, location, distance, category } : t
        );
        setTasks(updatedTasks);
        saveTasksToAsyncStorage(updatedTasks);
      }
      setEditingTaskId(null);
    } else {
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'INSERT INTO tasks (task, date, location, distance, category) VALUES (?,?,?,?,?);',
            [taskInput, dateString, location, distance, category],
            () => loadTasks(),
            (error: any) => console.log('Error inserting task in SQLite:', error)
          );
        });
      } else {
        const newTask: Task = {
          id: Math.random().toString(),
          task: taskInput,
          date: dateString,
          location,
          distance,
          category,
        };
        const updatedTasks = [...tasks, newTask];
        setTasks(updatedTasks);
        saveTasksToAsyncStorage(updatedTasks);
      }
    }
    // Reset input fields and close modal.
    setTaskInput('');
    setDate(new Date());
    setLocation('');
    setDistance('');
    setCategory('Travail');
    setModalVisible(false);
  };

  const handleDeleteTask = (id: string | number) => {
    if (Platform.OS !== 'web') {
      db.transaction((tx: any) => {
        tx.executeSql(
          'DELETE FROM tasks WHERE id=?;',
          [id],
          () => loadTasks(),
          (error: any) => console.log('Error deleting task from SQLite:', error)
        );
      });
    } else {
      const updatedTasks = tasks.filter((t) => t.id !== id);
      setTasks(updatedTasks);
      saveTasksToAsyncStorage(updatedTasks);
    }
  };

  const handleEditTask = (id: string | number) => {
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

  const sortTasksByCategory = () => {
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
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => {
          setModalVisible(true);
          setEditingTaskId(null);
          setTaskInput('');
          // Reset the date to today when opening the modal.
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
        onRequestClose={() => setModalVisible(false)}
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
              // Use react-datepicker on web.
              <WebDatePicker
                selected={date}
                onChange={(selectedDate: Date) => setDate(selectedDate)}
                dateFormat="yyyy-MM-dd"
              />
            ) : (
              // Use react-native-date-picker for Android/iOS in inline mode.
              <DatePickerMobile date={date} onDateChange={setDate} mode="date" />
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
            {/* Use the MapboxGLJSSelector component for location selection */}
            <MapboxGLJSSelector
              onLocationSelect={(coords) => {
                setLocation(JSON.stringify(coords));
                setLocationCoords(coords);
              }}
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalButton} onPress={handleSaveTask}>
                <Text style={styles.modalButtonText}>
                  {editingTaskId ? 'Modifier' : 'Ajouter'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 20, 
    backgroundColor: '#f0f0f0' 
  },
  header: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    marginTop: 20, 
    marginBottom: 20 
  },
  addButton: { 
    backgroundColor: '#4CAF50', 
    padding: 15, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginBottom: 20 
  },
  addButtonText: { 
    color: '#fff', 
    fontSize: 18 
  },
  sectionHeader: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    backgroundColor: '#eee', 
    padding: 5, 
    marginTop: 15 
  },
  taskItem: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
  },
  taskText: { 
    fontSize: 16, 
    marginBottom: 5 
  },
  buttonContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 10 
  },
  editButton: { 
    flex: 0.48, 
    padding: 10, 
    backgroundColor: 'orange', 
    borderRadius: 5, 
    alignItems: 'center' 
  },
  editButtonText: { 
    color: '#fff', 
    fontSize: 16 
  },
  deleteButton: { 
    flex: 0.48, 
    padding: 10, 
    backgroundColor: 'red', 
    borderRadius: 5, 
    alignItems: 'center' 
  },
  deleteButtonText: { 
    color: '#fff', 
    fontSize: 16 
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalContainer: { 
    width: '90%', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 20 
  },
  modalTitle: { 
    fontSize: 24, 
    fontWeight: '700', 
    marginBottom: 15, 
    textAlign: 'center', 
    color: '#333' 
  },
  modalInput: { 
    backgroundColor: '#f9f9f9', 
    height: 45, 
    borderColor: '#ddd', 
    borderWidth: 1, 
    borderRadius: 8, 
    marginBottom: 15, 
    paddingHorizontal: 15 
  },
  picker: { 
    height: 50, 
    width: '100%', 
    marginBottom: 15 
  },
  modalButtonContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  modalButton: { 
    flex: 1, 
    backgroundColor: '#4CAF50', 
    paddingVertical: 12, 
    borderRadius: 8, 
    marginHorizontal: 5, 
    alignItems: 'center' 
  },
  cancelButton: { 
    backgroundColor: '#F44336' 
  },
  modalButtonText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: '600' 
  },
});

export default TaskManagerScreen;
