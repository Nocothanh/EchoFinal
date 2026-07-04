# Jarvis AI - Build & Android Gradle 8.8 Fix

## 🔴 ERRORE RIPORTATO

```
WARNING: [Processor] Library containing references to AndroidX and old support library
The NODE_ENV environment variable is required but was not specified
```

## ✅ SOLUZIONE COMPLETA

### 1. Aggiungi a `android/gradle.properties`

```properties
# Gradle 8.8 compatibility
android.enableDexingArtifactTransform=false
android.useNewApkCreator=true
android.nonTransitiveRClass=true
android.suppressUnsupportedCompileSdkWarning=34
android.useAndroidX=true
android.enableJetifier=true

# Memory settings
org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m

# BuildTools version
android.buildToolsVersion=34.0.0
```

### 2. Verifica `android/build.gradle`

```gradle
buildscript {
    ext {
        buildToolsVersion = "34.0.0"
        minSdkVersion = 21
        compileSdkVersion = 34
        targetSdkVersion = 34
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath('com.android.tools.build:gradle:8.1.0')
        classpath('com.facebook.react:react-native-gradle-plugin')
    }
}
```

### 3. Verifica `package.json` scripts

```json
"scripts": {
  "build:apk": "NODE_ENV=production eas build -p android --profile preview",
  "build:aab": "NODE_ENV=production eas build -p android --profile production"
}
```

### 4. Build con NODE_ENV esplicito

```bash
# Development
NODE_ENV=development expo start --android

# Production release
NODE_ENV=production eas build -p android --profile preview
```

### 5. Se usi EAS Build

Crea/aggiorna `eas.json`:

```json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease",
        "env": {
          "NODE_ENV": "production"
        }
      }
    },
    "production": {
      "android": {
        "buildType": "aab",
        "env": {
          "NODE_ENV": "production"
        }
      }
    }
  }
}
```

### 6. Pulisci e rebuildizza

```bash
# Pulisci cache
rm -rf node_modules
rm -rf .gradle
rm -rf android/.gradle

# Reinstalla
npm install

# Build
NODE_ENV=production npm run build:apk
```

---

## 🎯 ALTERNATIVE QUICK FIX

Se il problema persiste, prova:

```bash
# Option 1: Use prebuild
expo prebuild --clean

# Option 2: Clear Gradle cache
./gradlew clean

# Option 3: Update Gradle wrapper
./gradlew wrapper --gradle-version 8.8
```

---

## ⚠️ PROBLEMI COMUNI

### ExoPlayer AndroidX/Support Library Mix

**Causa:** `expo-av` dipende da ExoPlayer con dipendenze miste

**Soluzione:** Expo gestisce automaticamente con Jetifier

```gradle
// In android/build.gradle
android.enableJetifier=true  // ✅ Gia impostato sopra
```

### AsyncStorage Package Name Warning

**Avvertimento:** "package name from source AndroidManifest is ignored"

**Azione:** Nessuna - warning non bloccante, Expo lo gestisce automaticamente

### Gradle Daemon Memory Issues

**Sintomo:** Build freeze o crash

**Soluzione:** Aumenta memoria JVM

```bash
export _JAVA_OPTIONS='-Xmx4096m'
NODE_ENV=production npm run build:apk
```

---

## ✅ VERIFICA SUCCESSIVA BUILD

Quando il build è completato con successo, dovresti vedere:

```
> Task :app:assembleRelease
> Task :app:validateSigningRelease
> Task :app:packageRelease
✅ BUILD SUCCESSFUL
```

L'APK sarà in: `android/app/build/outputs/apk/release/app-release.apk`

---

**Ultimo aggiornamento:** 2026-07-04
