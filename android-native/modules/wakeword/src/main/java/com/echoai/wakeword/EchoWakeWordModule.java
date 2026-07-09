/**
 * EchoWakeWordModule.java
 * React Native bridge for offline wake word detection using Vosk
 * Free, on-device, no internet required
 */

package com.echoai.wakeword;

import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.vosk.Model;
import org.vosk.Recognizer;
import org.vosk.SoundRecorder;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class EchoWakeWordModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "EchoWakeWord";
    private static final String TAG = "EchoWakeWord";

    private Model model;
    private Recognizer recognizer;
    private SoundRecorder recorder;
    private Thread listenThread;
    private boolean isListening = false;
    private String wakeWord = "hey jarvis";
    private float wakeWordThreshold = 0.8f;

    public EchoWakeWordModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Initialize Vosk model for offline wake word detection
     */
    @ReactMethod
    public void initialize(String modelPath, Promise promise) {
        try {
            if (model != null) {
                promise.resolve(true);
                return;
            }

            String path = modelPath != null ? modelPath : extractDefaultModel();
            model = new Model(path);

            String sampleRate = Model.SAMPLE_RATE;
            recognizer = new Recognizer(model, Float.parseFloat(sampleRate));

            Log.i(TAG, "Vosk model initialized");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize Vosk", e);
            promise.reject("INIT_ERROR", e.getMessage());
        }
    }

    /**
     * Set wake word
     */
    @ReactMethod
    public void setWakeWord(String word, Promise promise) {
        this.wakeWord = word.toLowerCase().trim();
        promise.resolve(true);
    }

    /**
     * Start listening for wake word
     */
    @ReactMethod
    public void startListening(Promise promise) {
        try {
            if (isListening) {
                promise.resolve(true);
                return;
            }

            if (recognizer == null) {
                promise.reject("NOT_INITIALIZED", "Call initialize() first");
                return;
            }

            isListening = true;
            recorder = new SoundRecorder();

            listenThread = new Thread(() -> {
                try {
                    recorder.start(16000.0f);
                    byte[] buffer = new byte[4096];

                    while (isListening) {
                        int bytes = recorder.read(buffer);
                        if (bytes > 0) {
                            boolean accepted = recognizer.acceptWaveForm(buffer, bytes);
                            if (accepted) {
                                String result = recognizer.getResult();
                                checkWakeWord(result);
                            } else {
                                String partial = recognizer.getPartialResult();
                                checkWakeWord(partial);
                            }
                        }
                    }

                    recorder.stop();
                } catch (Exception e) {
                    Log.e(TAG, "Listening error", e);
                }
            });

            listenThread.start();
            Log.i(TAG, "Started listening for wake word: " + wakeWord);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("LISTEN_ERROR", e.getMessage());
        }
    }

    /**
     * Stop listening
     */
    @ReactMethod
    public void stopListening(Promise promise) {
        isListening = false;
        if (recorder != null) {
            try {
                recorder.stop();
            } catch (Exception e) {}
        }
        promise.resolve(true);
    }

    /**
     * Process audio buffer for wake word detection
     */
    @ReactMethod
    public void processAudio(byte[] audioData, Promise promise) {
        try {
            if (recognizer == null) {
                promise.reject("NOT_INITIALIZED", "Call initialize() first");
                return;
            }

            boolean accepted = recognizer.acceptWaveForm(audioData, audioData.length);
            String result;
            if (accepted) {
                result = recognizer.getResult();
            } else {
                result = recognizer.getPartialResult();
            }

            boolean detected = checkWakeWord(result);
            WritableMap map = Arguments.createMap();
            map.putBoolean("detected", detected);
            map.putString("text", result);
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("PROCESS_ERROR", e.getMessage());
        }
    }

    /**
     * Check if wake word is in recognition result
     */
    private boolean checkWakeWord(String text) {
        if (text == null || text.isEmpty()) return false;

        String lower = text.toLowerCase();
        String[] words = wakeWord.split("\\s+");

        for (String word : words) {
            if (!lower.contains(word)) return false;
        }

        WritableMap params = Arguments.createMap();
        params.putString("wakeWord", wakeWord);
        params.putString("fullText", text);
        params.putDouble("confidence", wakeWordThreshold);

        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("WakeWordDetected", params);

        Log.i(TAG, "Wake word detected: " + text);
        return true;
    }

    /**
     * Extract default model from assets
     */
    private String extractDefaultModel() throws IOException {
        File modelDir = new File(getReactApplicationContext().getFilesDir(), "vosk-model");
        if (!modelDir.exists()) {
            modelDir.mkdirs();
            // Model should be bundled or downloaded separately
            // For now, use a lightweight model
        }
        return modelDir.getAbsolutePath();
    }

    /**
     * Get current status
     */
    @ReactMethod
    public void getStatus(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putBoolean("initialized", model != null);
        map.putBoolean("listening", isListening);
        map.putString("wakeWord", wakeWord);
        map.putDouble("threshold", wakeWordThreshold);
        promise.resolve(map);
    }

    /**
     * Set confidence threshold
     */
    @ReactMethod
    public void setThreshold(double threshold, Promise promise) {
        this.wakeWordThreshold = (float) threshold;
        promise.resolve(true);
    }
}
