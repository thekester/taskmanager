import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Image,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  View,
  Text,
  Button,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from 'expo-router';
import SQLite from 'react-native-sqlite-storage';
import * as Notifications from 'expo-notifications';
import * as Linking from 'expo-linking';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParallaxScrollView from '@/components/ParallaxScrollView';

declare global {
  interface Window {
    mapboxgl: any;
    MapboxSearchBox: any;
  }
}

interface Task {
  id: number;
  task: string;
  date: string; // Date et heure
  location?: string; // JSON string représentant un tableau [longitude, latitude]
  distance?: string;
  category?: string;
}

let db: any = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabase({ name: 'tasks.db', location: 'default' });
}

interface MapboxGLJSWebViewProps {
  tasks?: Task[];
  onEditTask?: (taskId: string) => void;
  // Nouvelle prop pour faire flyTo
  flyToCoords?: [number, number] | null;
}

const MapboxGLJSWebView: React.FC<MapboxGLJSWebViewProps> = ({
  tasks = [],
  onEditTask,
  flyToCoords = null,
}) => {
  const MAPBOX_ACCESS_TOKEN =
    'pk.eyJ1IjoibWFwcHltYWFuaWFjIiwiYSI6ImNtODFuZ3AxejEyZmUycnM1MHFpazN0OXQifQ.Y_6RTH2rn8M1QOgSHEQhJg';

  const extractMarkers = () => {
    return tasks
      .filter((t) => typeof t.location === 'string' && t.location.trim() !== '')
      .map((t) => ({
        coords: JSON.parse(t.location as string),
        task: t,
      }));
  };

  const markers = extractMarkers();
  const mapContainer = useRef<HTMLDivElement>(null);
  // Référence pour stocker l'instance de la carte (web)
  const mapRef = useRef<any>(null);
  // Référence pour la WebView (mobile)
  const webviewRef = useRef<WebView>(null);

  // Version Web
  if (Platform.OS === 'web') {
    useEffect(() => {
      function initializeMap() {
        if (window.mapboxgl && mapContainer.current) {
          window.mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
          const map = new window.mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/standard',
            center: [-74.5, 40],
            zoom: 9,
          });
          mapRef.current = map;
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

            // Fonction globale pour l'édition (appelée par onclick)
            (window as any).handleEdit = function (taskId: string) {
              if (onEditTask) {
                onEditTask(taskId);
              } else {
                console.log('Edit task requested for task id:', taskId);
              }
            };

            // Ajout des marqueurs avec popup
            markers.forEach((item) => {
              const { coords, task } = item;
              const popupHTML = `
                <div>
                  <strong>${task.task}</strong><br>
                  Date: ${task.date}<br>
                  ${
                    task.distance ? 'Distance: ' + task.distance + 'm<br>' : ''
                  }
                  ${
                    task.category ? 'Catégorie: ' + task.category + '<br>' : ''
                  }
                  <button onclick="handleEdit('${task.id}')">Modifier</button>
                </div>
              `;
              new window.mapboxgl.Marker()
                .setLngLat(coords)
                .setPopup(
                  new window.mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML)
                )
                .addTo(map);
            });
          });

          map.on('click', (e: any) => {
            const lngLat = e.lngLat;
            console.log('Map clicked at:', lngLat);
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
    }, [MAPBOX_ACCESS_TOKEN, tasks, onEditTask]);

    // Fly-to si flyToCoords change
    useEffect(() => {
      if (flyToCoords && mapRef.current) {
        mapRef.current.flyTo({
          center: flyToCoords,
          zoom: 14,
          essential: true,
        });
      }
    }, [flyToCoords]);

    return (
      <div
        ref={mapContainer}
        style={{ height: '300px', width: '100%', marginTop: '10px', marginBottom: '10px' }}
      />
    );
  }
  // Version Mobile via WebView
  else {
    const htmlContent = `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>Mapbox GL JS</title>
    <meta name="viewport" content="initial-scale=1,maximum-scale=1,user-scalable=no">
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css" rel="stylesheet">
    <script src="https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js"></script>
    <script id="search-js" defer src="https://api.mapbox.com/search-js/v1.0.0/web.js"></script>
    <style>
      body { margin: 0; padding: 0; }
      #map { position: absolute; top: 0; bottom: 0; width: 100%; }
      button { font-size: 14px; padding: 4px 8px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      mapboxgl.accessToken = '${MAPBOX_ACCESS_TOKEN}';
      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/standard',
        center: [-74.5, 40],
        zoom: 9
      });
      window.map = map;
      map.addControl(new mapboxgl.NavigationControl());
      map.on('click', (e) => {
        const lngLat = e.lngLat;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'mapClick',
          longitude: lngLat.lng,
          latitude: lngLat.lat
        }));
      });
      window.handleEdit = function(taskId) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'editTask', id: taskId }));
      };
      window.addEventListener('load', () => {
        const searchBox = new MapboxSearchBox();
        searchBox.accessToken = mapboxgl.accessToken;
        searchBox.options = {
          types: 'address,poi',
          proximity: [-74.0066, 40.7135]
        };
        searchBox.marker = true;
        searchBox.mapboxgl = mapboxgl;
        map.addControl(searchBox);
        const markers = ${JSON.stringify(markers)};
        markers.forEach(item => {
          const popupHTML = '<div>' +
            '<strong>' + item.task.task + '</strong><br>' +
            'Date: ' + item.task.date + '<br>' +
            (item.task.distance ? ('Distance: ' + item.task.distance + 'm<br>') : '') +
            (item.task.category ? ('Catégorie: ' + item.task.category + '<br>') : '') +
            '<button onclick="handleEdit(\\'' + item.task.id + '\\')">Modifier</button>' +
            '</div>';
          new mapboxgl.Marker()
            .setLngLat(item.coords)
            .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
            .addTo(map);
        });
      });
      // Écoute des messages pour flyTo depuis React Native
      document.addEventListener("message", function(event) {
        try {
          const data = JSON.parse(event.data);
          if(data.type === 'flyTo' && data.coords){
            map.flyTo({
              center: data.coords,
              zoom: 14,
              essential: true
            });
          }
        } catch(e){
          console.error('Erreur lors du traitement du message:', e);
        }
      });
    </script>
  </body>
</html>
    `;
    // Injection du flyTo dans la WebView
    useEffect(() => {
      if (flyToCoords && webviewRef.current) {
        const jsCode = `
          map.flyTo({
            center: [${flyToCoords[0]}, ${flyToCoords[1]}],
            zoom: 14,
            essential: true
          });
          true;
        `;
        webviewRef.current.injectJavaScript(jsCode);
      }
    }, [flyToCoords]);

    return (
      <View style={styles.mapContainer}>
        <WebView
          ref={webviewRef}
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.map}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'editTask' && onEditTask) {
                onEditTask(data.id);
              } else {
                console.log('Message from map:', data);
              }
            } catch (err) {
              console.error('Error parsing map message:', err);
            }
          }}
        />
      </View>
    );
  }
};

export default function HomeScreen() {
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('');
  const [distance, setDistance] = useState('');
  const [category, setCategory] = useState('Travail');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  // Nouvelle state pour flyTo (coordonnées)
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  // State pour vérifier l'état des notifications
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  const router = useRouter();

  // Vérifier l'état des permissions de notifications au montage
  useEffect(() => {
    async function checkNotifPermissions() {
      const { status } = await Notifications.getPermissionsAsync();
      setNotifStatus(status);
    }
    checkNotifPermissions();
  }, []);

  // Fonction pour activer les notifications
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

  // Chargement initial ou depuis le focus
  const loadRecentTasks = () => {
    const today = new Date().toISOString().slice(0, 10);
    db.transaction((tx: any) => {
      tx.executeSql(
        'SELECT * FROM tasks WHERE date <= ? ORDER BY date DESC;',
        [today],
        (_: any, results: any) => {
          const loaded: Task[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            loaded.push(results.rows.item(i));
          }
          setRecentTasks(loaded);
        },
        (error: any) =>
          console.log('Erreur lors du chargement des tâches récentes:', error)
      );
    });
  };

  const loadUpcomingTasks = () => {
    const today = new Date().toISOString().slice(0, 10);
    db.transaction((tx: any) => {
      tx.executeSql(
        'SELECT * FROM tasks WHERE date > ? ORDER BY date ASC;',
        [today],
        (_: any, results: any) => {
          const loaded: Task[] = [];
          for (let i = 0; i < results.rows.length; i++) {
            loaded.push(results.rows.item(i));
          }
          setUpcomingTasks(loaded);
        },
        (error: any) =>
          console.log('Erreur lors du chargement des tâches à venir:', error)
      );
    });
  };

  const filterTasks = (tasks: Task[]) => {
    const now = new Date();
    const recent = tasks
      .filter((task) => new Date(task.date) <= now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const upcoming = tasks
      .filter((task) => new Date(task.date) > now)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    setRecentTasks(recent);
    setUpcomingTasks(upcoming);
  };

  // useFocusEffect pour recharger les tâches à chaque focus de l'écran
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'web') {
        loadRecentTasks();
        loadUpcomingTasks();
      } else {
        const tasksStr = localStorage.getItem('tasks');
        if (tasksStr) {
          const tasks: Task[] = JSON.parse(tasksStr);
          filterTasks(tasks);
        }
      }
    }, [])
  );

  const handleSaveTask = () => {
    const dateString = date.toISOString();
    if (!taskInput || !dateString) {
      alert('Veuillez remplir au moins le titre et la date.');
      return;
    }
    if (editingTaskId) {
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'UPDATE tasks SET task=?, date=?, location=?, distance=?, category=? WHERE id=?;',
            [taskInput, dateString, location, distance, category, editingTaskId],
            () => {
              loadRecentTasks();
              loadUpcomingTasks();
            },
            (error: any) =>
              console.log('Erreur lors de la mise à jour:', error)
          );
        });
      } else {
        const updatedTasks = recentTasks.concat(upcomingTasks).map((t) =>
          t.id === parseInt(editingTaskId)
            ? {
                ...t,
                task: taskInput,
                date: dateString,
                location,
                distance,
                category,
              }
            : t
        );
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        filterTasks(updatedTasks);
      }
      setEditingTaskId(null);
    } else {
      if (Platform.OS !== 'web') {
        db.transaction((tx: any) => {
          tx.executeSql(
            'INSERT INTO tasks (task, date, location, distance, category) VALUES (?,?,?,?,?);',
            [taskInput, dateString, location, distance, category],
            (tx: any, result: any) => {
              console.log('[TasksScreen] Task added successfully in SQLite with id:', result.insertId);
              loadRecentTasks();
              loadUpcomingTasks();
            },
            (error: any) =>
              console.log("Erreur lors de l'insertion:", error)
          );
        });
      } else {
        const newTask: Task = {
          id: Math.floor(Math.random() * 100000),
          task: taskInput,
          date: dateString,
          location,
          distance,
          category,
        };
        const updatedTasks = [...recentTasks, ...upcomingTasks, newTask];
        localStorage.setItem('tasks', JSON.stringify(updatedTasks));
        filterTasks(updatedTasks);
        console.log('[TasksScreen] Task added successfully in localStorage');
      }
    }
    setTaskInput('');
    setDate(new Date());
    setLocation('');
    setDistance('');
    setCategory('Travail');
  };

  // Pour l'édition depuis la carte
  const handleEditTaskFromMap = (taskId: string) => {
    const allTasks = [...recentTasks, ...upcomingTasks];
    const taskToEdit = allTasks.find((t) => t.id.toString() === taskId);
    if (taskToEdit) {
      setTaskInput(taskToEdit.task);
      setDate(new Date(taskToEdit.date));
      setLocation(taskToEdit.location || '');
      setDistance(taskToEdit.distance || '');
      setCategory(taskToEdit.category || 'Travail');
      setEditingTaskId(taskToEdit.id.toString());
      setModalVisible(true);
      router.push(`/tasks?editTaskId=${taskToEdit.id.toString()}`);
    }
  };

  // Fonction pour recentrer la carte sur les coordonnées d'une tâche
  const handleViewOnMap = (coords: [number, number]) => {
    setFlyToCoords(coords);
    // Vous pouvez ajouter ici un scroll ou une navigation vers la section carte si nécessaire
  };

  // Composant pour afficher une tâche avec le bouton "View on Map" si la tâche possède une localisation
  const TaskItem: React.FC<{ task: Task }> = ({ task }) => (
    <ThemedView style={styles.taskItem}>
      <ThemedText style={styles.taskTitle}>{task.task}</ThemedText>
      <ThemedText style={styles.taskSubtitle}>{task.date}</ThemedText>
      {task.location && task.location.trim() !== '' && (
        <TouchableOpacity
          onPress={() => {
            if (task.location) {
              const coords = JSON.parse(task.location);
              handleViewOnMap(coords);
            }
          }}
        >
          <ThemedText style={{ color: 'blue', marginTop: 8 }}>View on Map</ThemedText>
        </TouchableOpacity>
      )}
    </ThemedView>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Section pour afficher l'état des notifications et activer si nécessaire */}
      <View style={styles.notifContainer}>
        <Text style={styles.notifStatusText}>
          Notifications : {notifStatus || 'inconnu'}
        </Text>
        {notifStatus !== 'granted' && (
          <Button title="Activate Notifications" onPress={handleActivateNotifications} />
        )}
      </View>

      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={
          <Image
            source={require('@/assets/images/partial-react-logo.png')}
            style={styles.reactLogo}
          />
        }
      >
        <LinearGradient colors={['#FF7E5F', '#FEB47B']} style={styles.headerGradient}>
          <ThemedText type="title" style={styles.headerTitle}>
            Task Manager
          </ThemedText>
          <ThemedText style={styles.headerSubtitle}>
            Gérez vos tâches avec style
          </ThemedText>
        </LinearGradient>

        <ThemedView style={styles.sectionContainer}>
          <ThemedText type="subtitle">Mes tâches récemment créées</ThemedText>
          {recentTasks.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              Aucune tâche encore ajoutée
            </ThemedText>
          ) : (
            <FlatList
              data={recentTasks}
              renderItem={({ item }) => <TaskItem task={item} />}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.taskList}
            />
          )}
        </ThemedView>

        <ThemedView style={styles.sectionContainer}>
          <ThemedText type="subtitle">Tâches à venir</ThemedText>
          {upcomingTasks.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              Aucune tâche programmée. Vérifie que la date de ta tâche est dans le futur.
            </ThemedText>
          ) : (
            <FlatList
              data={upcomingTasks}
              renderItem={({ item }) => <TaskItem task={item} />}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.taskList}
            />
          )}
        </ThemedView>

        <ThemedView style={styles.sectionContainer}>
          <ThemedText type="subtitle">Carte des tâches</ThemedText>
          <MapboxGLJSWebView
            tasks={[...recentTasks, ...upcomingTasks]}
            onEditTask={handleEditTaskFromMap}
            flyToCoords={flyToCoords}
          />
        </ThemedView>
      </ParallaxScrollView>

      <TouchableOpacity
        style={styles.floatingButton}
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
        <ThemedText style={styles.floatingButtonText}>+</ThemedText>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notifContainer: {
    padding: 10,
    backgroundColor: '#eee',
    alignItems: 'center',
  },
  notifStatusText: {
    fontSize: 16,
    marginBottom: 5,
  },
  headerGradient: {
    padding: 20,
    alignItems: 'center',
    borderRadius: 10,
    margin: 16,
    marginTop: 60,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle: { fontSize: 16, color: '#fff', marginTop: 4 },
  sectionContainer: { marginTop: 10, marginBottom: 10, paddingHorizontal: 20 },
  emptyText: { fontSize: 16, color: '#777', marginTop: 10, textAlign: 'center' },
  taskList: { paddingVertical: 10 },
  taskItem: {
    backgroundColor: '#fff',
    padding: 20,
    marginRight: 15,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
    minWidth: 200,
  },
  taskTitle: { fontSize: 18, fontWeight: '600' },
  taskSubtitle: { fontSize: 14, color: '#555', marginTop: 8 },
  reactLogo: { height: 178, width: 290, bottom: 0, left: 0, position: 'absolute' },
  floatingButton: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#FF7E5F',
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  floatingButtonText: { fontSize: 30, color: '#fff' },
  mapContainer: { height: 300, marginTop: 10, marginBottom: 10 },
  map: { flex: 1 },
});
