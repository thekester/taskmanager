// tasks.tsx
import React, { useState, useEffect } from 'react';
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

// ***** expo-router *****
import { useLocalSearchParams } from 'expo-router';

// Pour web, import react-datepicker et son CSS
let WebDatePicker: any = null;
if (Platform.OS === 'web') {
  WebDatePicker = require('react-datepicker').default;
  require('react-datepicker/dist/react-datepicker.css');
}

// Pour mobile, import react-native-date-picker
import DatePickerMobile from 'react-native-date-picker';

interface Task {
  id: string | number;
  task: string;
  date: string;
  location?: string;
  distance?: string;
  category: string;
}

let db: any = null;
if (Platform.OS !== 'web') {
  db = SQLite.openDatabase({ name: 'tasks.db', location: 'default' });
}

const TasksScreen: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [taskInput, setTaskInput] = useState('');
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('');
  const [distance, setDistance] = useState('');
  const [category, setCategory] = useState('Travail');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // ***** Récupérer l’ID de la tâche à éditer via expo-router *****
  // Sur les versions < v2, le hook s'appelle useLocalSearchParams :
  const { editTaskId } = useLocalSearchParams();

  // Ouvrir la DB et charger les tâches
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

  // Vérifie si un editTaskId est présent, et ouvre la pop-up
  useEffect(() => {
    if (editTaskId) {
      const taskToEdit = tasks.find(
        (t) => t.id.toString() === editTaskId.toString()
      );
      if (taskToEdit) {
        setTaskInput(taskToEdit.task);
        setDate(new Date(taskToEdit.date));
        setLocation(taskToEdit.location || '');
        setDistance(taskToEdit.distance || '');
        setCategory(taskToEdit.category || 'Travail');
        setEditingTaskId(taskToEdit.id.toString());
        setModalVisible(true);
      }
    }
  }, [editTaskId, tasks]);

  const saveTasksToAsyncStorage = async (updatedTasks: Task[]) => {
    try {
      await AsyncStorage.setItem('tasks', JSON.stringify(updatedTasks));
    } catch (error) {
      console.error('Error saving tasks to AsyncStorage:', error);
    }
  };

  const handleSaveTask = () => {
    const dateString = date.toISOString();
    if (!taskInput || !dateString) {
      Alert.alert('Erreur', 'Veuillez remplir au moins le titre et la date.');
      return;
    }
    if (editingTaskId) {
      // Mise à jour
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
        const updatedTasks = tasks.map((t: Task) =>
          t.id === editingTaskId
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
        setTasks(updatedTasks);
        saveTasksToAsyncStorage(updatedTasks);
      }
      setEditingTaskId(null);
    } else {
      // Insertion
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
          id: Math.floor(Math.random() * 100000),
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
      const updatedTasks = tasks.filter((t: Task) => t.id !== id);
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
        keyExtractor={(item: Task) => item.id.toString()}
        renderItem={renderTaskItem}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
      />

      {/* MODAL */}
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
              <DatePickerMobile date={date} onDateChange={setDate} mode="datetime" />
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

export default TasksScreen;

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f0f0f0' },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: { color: '#fff', fontSize: 18 },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    backgroundColor: '#eee',
    padding: 5,
    marginTop: 15,
  },
  taskItem: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  taskText: { fontSize: 16, marginBottom: 5 },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  editButton: {
    flex: 0.48,
    padding: 10,
    backgroundColor: 'orange',
    borderRadius: 5,
    alignItems: 'center',
  },
  editButtonText: { color: '#fff', fontSize: 16 },
  deleteButton: {
    flex: 0.48,
    padding: 10,
    backgroundColor: 'red',
    borderRadius: 5,
    alignItems: 'center',
  },
  deleteButtonText: { color: '#fff', fontSize: 16 },
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
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  modalInput: {
    backgroundColor: '#f9f9f9',
    height: 45,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 15,
    paddingHorizontal: 15,
  },
  picker: { height: 50, width: '100%', marginBottom: 15 },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cancelButton: { backgroundColor: '#F44336' },
  modalButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
});
