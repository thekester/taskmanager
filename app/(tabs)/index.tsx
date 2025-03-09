import React, { useEffect, useState, useRef } from 'react';
import {
  Image,
  StyleSheet,
  FlatList,
  SafeAreaView,
  TouchableOpacity,
  Platform,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import SQLite from 'react-native-sqlite-storage';

// Extend global Window to include Mapbox properties
declare global {
  interface Window {
    mapboxgl: any;
    MapboxSearchBox: any;
  }
}

interface Task {
  id: number;
  task: string;
  date: string; // Scheduled or creation date
  location?: string; // JSON string representing a tuple [longitude, latitude]
  distance?: string;
  category?: string;
}

let db: any = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabase({ name: 'tasks.db', location: 'default' });
}

/**
 * MapboxGLJSWebView Component
 *
 * For mobile: Loads a WebView that displays an HTML page using Mapbox GL JS.
 * For web: Injects the Mapbox GL JS scripts/CSS directly into a div.
 * A search box is added after the map loads.
 */
const MapboxGLJSWebView: React.FC = () => {
  const MAPBOX_ACCESS_TOKEN =
    'pk.eyJ1IjoibWFwcHltYWFuaWFjIiwiYSI6ImNtODFuZ3AxejEyZmUycnM1MHFpazN0OXQifQ.Y_6RTH2rn8M1QOgSHEQhJg';

  if (Platform.OS === 'web') {
    const mapContainer = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (mapContainer.current && !document.getElementById('mapbox-gl-css')) {
        // Inject Mapbox CSS
        const link = document.createElement('link');
        link.id = 'mapbox-gl-css';
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css';
        document.head.appendChild(link);

        // Inject Mapbox JS
        const script = document.createElement('script');
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js';
        script.async = true;
        document.body.appendChild(script);

        // Inject Search JS
        const searchScript = document.createElement('script');
        searchScript.id = 'search-js';
        searchScript.defer = true;
        searchScript.src = 'https://api.mapbox.com/search-js/v1.0.0/web.js';
        document.body.appendChild(searchScript);

        script.onload = () => initializeMap();
      } else {
        initializeMap();
      }

      function initializeMap() {
        // @ts-ignore
        if (window.mapboxgl && mapContainer.current) {
          // @ts-ignore
          window.mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
          // @ts-ignore
          const map = new window.mapboxgl.Map({
            container: mapContainer.current,
            style: 'mapbox://styles/mapbox/standard',
            center: [-74.5, 40],
            zoom: 9,
          });
          // @ts-ignore
          map.addControl(new window.mapboxgl.NavigationControl());
          // Add search box after the map loads
          window.addEventListener('load', () => {
            // @ts-ignore
            const searchBox = new window.MapboxSearchBox();
            searchBox.accessToken = window.mapboxgl.accessToken;
            searchBox.options = {
              types: 'address,poi',
              proximity: [-74.0066, 40.7135],
            };
            searchBox.marker = true;
            searchBox.mapboxgl = window.mapboxgl;
            map.addControl(searchBox);
          });
          map.on('click', (e: any) => {
            const lngLat = e.lngLat;
            console.log('Map clicked at:', lngLat);
          });
        }
      }
    }, []);
    return (
      <div
        ref={mapContainer}
        style={{ height: '300px', width: '100%', marginTop: '10px', marginBottom: '10px' }}
      />
    );
  } else {
    // Mobile implementation using WebView
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
      map.addControl(new mapboxgl.NavigationControl());
      map.on('click', (e) => {
        const lngLat = e.lngLat;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          longitude: lngLat.lng,
          latitude: lngLat.lat
        }));
      });
      // Add search box after the map loads
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
      });
    </script>
  </body>
</html>
    `;
    return (
      <View style={styles.mapContainer}>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlContent }}
          style={styles.map}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              console.log('Map click received:', data);
            } catch (err) {
              console.error('Error parsing map message:', err);
            }
          }}
        />
      </View>
    );
  }
};

function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);

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
      const tasksStr = localStorage.getItem('tasks');
      if (tasksStr) setTasks(JSON.parse(tasksStr));
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
          },
          (error: any) => console.log('Error loading tasks:', error)
        );
      });
    } else {
      const tasksStr = localStorage.getItem('tasks');
      if (tasksStr) setTasks(JSON.parse(tasksStr));
    }
  };

  // Split tasks based on current date
  const now = new Date();
  const recentTasks = tasks
    .filter(task => new Date(task.date) <= now)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const upcomingTasks = tasks
    .filter(task => new Date(task.date) > now)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const TaskItem: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
    <ThemedView style={styles.taskItem}>
      <ThemedText style={styles.taskTitle}>{title}</ThemedText>
      <ThemedText style={styles.taskSubtitle}>{subtitle}</ThemedText>
    </ThemedView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ParallaxScrollView
        headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
        headerImage={<Image source={require('@/assets/images/partial-react-logo.png')} style={styles.reactLogo} />}
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
          <ThemedText type="subtitle">Mes tâches récentes</ThemedText>
          {recentTasks.length === 0 ? (
            <ThemedText style={styles.emptyText}>Aucune tâche encore ajoutée</ThemedText>
          ) : (
            <FlatList
              data={recentTasks}
              renderItem={({ item }) => <TaskItem title={item.task} subtitle={item.date} />}
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
            <ThemedText style={styles.emptyText}>Aucune tâche programmée</ThemedText>
          ) : (
            <FlatList
              data={upcomingTasks}
              renderItem={({ item }) => <TaskItem title={item.task} subtitle={item.date} />}
              keyExtractor={(item) => item.id.toString()}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.taskList}
            />
          )}
        </ThemedView>

        <ThemedView style={styles.sectionContainer}>
          <ThemedText type="subtitle">Carte des tâches</ThemedText>
          {/* For both mobile and web, load the Mapbox GL JS map */}
          <MapboxGLJSWebView />
        </ThemedView>
      </ParallaxScrollView>

      <TouchableOpacity style={styles.floatingButton}>
        <ThemedText style={styles.floatingButtonText}>+</ThemedText>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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

export default HomeScreen;