/**
 * withEchoNative.js
 * Expo config plugin to add native Android modules to Echo
 * Run: npx expo prebuild --platform android
 */

const { withAndroidManifest, withAppBuildGradle } = require('@expo/config-plugins');

const ECHO_ACCESSIBILITY_SERVICE = `
<service
    android:name=".accessibility.EchoAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="false">
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/accessibility_config" />
</service>
`;

const ACCESSIBILITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:description="@string/accessibility_service_description"
    android:accessibilityEventTypes="typeViewClicked|typeViewTextChanged|typeWindowStateChanged|typeNotificationStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="100"
    android:settingsActivity="com.echoai.MainActivity" />
`;

const ACCESSIBILITY_DESCRIPTION = `<resources>
    <string name="accessibility_service_description">Echo JARVIS uses this to read screen content and control apps by voice.</string>
</resources>`;

function withEchoNative(config) {
  // Add Accessibility Service to AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const application = manifest.application[0];

    if (!application.service) {
      application.service = [];
    }

    // Add accessibility service
    const serviceExists = application.service.some(
      s => s.$?.['android:name']?.includes('EchoAccessibilityService')
    );

    if (!serviceExists) {
      application.service.push({
        $: {
          'android:name': '.accessibility.EchoAccessibilityService',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'false'
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }]
        }],
        'meta-data': [{
          $: {
            'android:name': 'android.accessibilityservice',
            'android:resource': '@xml/accessibility_config'
          }
        }]
      });
    }

    // Add permissions
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.RECORD_AUDIO',
      'android.permission.FOREGROUND_SERVICE',
      'android.permission.FOREGROUND_SERVICE_MICROPHONE'
    ];

    permissions.forEach(perm => {
      const exists = manifest['uses-permission'].some(
        p => p.$?.['android:name'] === perm
      );
      if (!exists) {
        manifest['uses-permission'].push({
          $: { 'android:name': perm }
        });
      }
    });

    return config;
  });

  // Add native modules to build.gradle
  config = withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('echoai.accessibility')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {
    implementation project(':echoai-accessibility')
    implementation project(':echoai-wakeword')
    implementation project(':echoai-localllm')
    implementation 'org.vosk:vosk-android:0.3.47'`
      );
    }
    return config;
  });

  return config;
}

module.exports = withEchoNative;
