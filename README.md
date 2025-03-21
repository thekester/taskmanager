
# Application React Native Task Manager

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

# Task Manager App

## 📱 Présentation de l'application
Task Manager est une application multiplateforme conçue avec Expo et React Native, permettant de gérer efficacement vos tâches au quotidien, de les visualiser sur une carte interactive, et de recevoir des rappels personnalisés sous forme de notifications ou d'alarmes.

Développé par Mathis JAMIN et Théophile Avenel

---

## ✨ Fonctionnalités clés

### 🗓️ Gestion des tâches
- Ajoutez, modifiez et supprimez vos tâches facilement.
- Classez vos tâches par catégorie : travail, famille, divers, etc.
- Affichez un calendrier interactif avec vue mensuelle et quotidienne.

### 🌍 Carte Interactive (Mapbox GL)
- Visualisez l'emplacement exact de vos tâches sur une carte interactive.
- Ajoutez facilement des emplacements à vos tâches en sélectionnant directement sur la carte.

### 🔔 Notifications et alarmes
- Notifications instantanées lors de la création ou modification de tâches.
- Rappels configurables quelques minutes avant l'heure prévue pour vos tâches.
- Gestion fine des autorisations pour activer les alarmes sur Android.

### 🗄️ Stockage local
- Stockage persistant des tâches avec SQLite (Android/iOS) ou LocalStorage/AsyncStorage (Web).

### 🔄 Compatibilité multiplateforme
- Application compatible avec Web, Android, et iOS grâce à Expo.

### ⚙️ Configuration utilisateur avancée
- Activez/désactivez les alarmes et les notifications.
- Définissez le délai personnalisé pour les rappels avant vos tâches.

---

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a:

- [Development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## 📹 Démonstrations en vidéo

### 🚀 Première étape
[![Voir la vidéo - Étape 1](https://img.youtube.com/vi/-OSjW0XGnHw/maxresdefault.jpg)](https://youtu.be/-OSjW0XGnHw)

### ✨ Deuxième étape
[![Voir la vidéo - Étape 2](https://img.youtube.com/vi/xVnZLxmwNOc/maxresdefault.jpg)](https://youtu.be/xVnZLxmwNOc)

### ✨ Rendu final
[![Voir la vidéo - Étape 3](https://img.youtube.com/vi/12m2co5ozTA/maxresdefault.jpg)](https://youtu.be/12m2co5ozTA)


## Installed Dependencies

Here is the complete list of dependencies and libraries installed in this project:

- Expo Linear Gradient: `npm install expo-linear-gradient --save`
- React Native SVG Transformer: `npm install react-native-svg-transformer --save-dev`
- React Native SQLite Storage: `npm install react-native-sqlite-storage --save`
- AsyncStorage: `npm install @react-native-async-storage/async-storage --save`
- React Native Picker: `npm install @react-native-picker/picker --save`
- React Datepicker (Web): `npm install react-datepicker --save`
- React Native Date Picker (Mobile): `npm install react-native-date-picker --save`
- Expo Notifications: `npm install expo-notifications`
- Material UI Icons: 
  - `npm install @mui/icons-material --save`
  - `npm install @material-ui/icons --save`
- Material UI Components: `npm install @mui/material @mui/icons-material @emotion/react @emotion/styled`
- React Native Calendars: `npm install react-native-calendars --save`
- AnimeJS (for animations on web): `npm install animejs --save`
- React Native Animatable (for animations on mobile): `npm install react-native-animatable`
- React Native NetInfo: `npm install --save @react-native-community/netinfo`
- React Native FS (File System): `npm install react-native-fs@latest --save`

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.