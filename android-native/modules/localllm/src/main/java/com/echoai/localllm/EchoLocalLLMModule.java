/**
 * EchoLocalLLMModule.java
 * React Native bridge for on-device LLM via llama.cpp
 * Runs small models (Qwen2.5 1.5B, Phi-3 mini) locally
 */

package com.echoai.localllm;

import android.os.AsyncTask;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class EchoLocalLLMModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "EchoLocalLLM";
    private static final String TAG = "EchoLocalLLM";

    private long nativeHandle = 0;
    private boolean isModelLoaded = false;
    private boolean isGenerating = false;
    private String modelPath;
    private int contextSize = 2048;
    private int threads = 4;

    // Load native library
    static {
        try {
            System.loadLibrary("localllm");
        } catch (UnsatisfiedLinkError e) {
            Log.e(TAG, "Failed to load native library", e);
        }
    }

    // Native methods
    private native long nativeInit(String modelPath, int contextSize, int threads);
    private native void nativeDestroy(long handle);
    private native String nativeGenerate(long handle, String prompt, int maxTokens, float temperature, float topP);
    private native void nativeCancelGenerate(long handle);
    private native boolean nativeIsModelLoaded(long handle);
    private native String nativeGetModelInfo(long handle);
    private native int nativeGetTokenCount(long handle, String text);

    public EchoLocalLLMModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Load a GGUF model from local storage
     */
    @ReactMethod
    public void loadModel(String path, ReadableMap options, Promise promise) {
        AsyncTask.execute(() -> {
            try {
                if (isModelLoaded) {
                    promise.resolve(true);
                    return;
                }

                modelPath = path;
                if (options != null) {
                    contextSize = options.hasKey("contextSize") ? options.getInt("contextSize") : 2048;
                    threads = options.hasKey("threads") ? options.getInt("threads") : 4;
                }

                nativeHandle = nativeInit(modelPath, contextSize, threads);

                if (nativeHandle != 0) {
                    isModelLoaded = true;
                    Log.i(TAG, "Model loaded: " + modelPath);
                    promise.resolve(true);
                } else {
                    promise.reject("LOAD_ERROR", "Failed to load model");
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to load model", e);
                promise.reject("LOAD_ERROR", e.getMessage());
            }
        });
    }

    /**
     * Generate text from prompt
     */
    @ReactMethod
    public void generate(String prompt, ReadableMap options, Promise promise) {
        if (!isModelLoaded) {
            promise.reject("NOT_LOADED", "Load a model first");
            return;
        }

        int maxTokens = 512;
        float temperature = 0.7f;
        float topP = 0.9f;

        if (options != null) {
            if (options.hasKey("maxTokens")) maxTokens = options.getInt("maxTokens");
            if (options.hasKey("temperature")) temperature = (float) options.getDouble("temperature");
            if (options.hasKey("topP")) topP = (float) options.getDouble("topP");
        }

        final int finalMaxTokens = maxTokens;
        final float finalTemperature = temperature;
        final float finalTopP = topP;

        AsyncTask.execute(() -> {
            try {
                isGenerating = true;
                String result = nativeGenerate(nativeHandle, prompt, finalMaxTokens, finalTemperature, finalTopP);
                isGenerating = false;

                WritableMap map = Arguments.createMap();
                map.putString("text", result);
                map.putBoolean("done", true);
                promise.resolve(map);
            } catch (Exception e) {
                isGenerating = false;
                Log.e(TAG, "Generation failed", e);
                promise.reject("GEN_ERROR", e.getMessage());
            }
        });
    }

    /**
     * Generate with streaming (events emitted)
     */
    @ReactMethod
    public void generateStream(String prompt, ReadableMap options) {
        if (!isModelLoaded) {
            WritableMap error = Arguments.createMap();
            error.putString("error", "Load a model first");
            emitEvent("LLMError", error);
            return;
        }

        int maxTokens = 512;
        float temperature = 0.7f;
        float topP = 0.9f;

        if (options != null) {
            if (options.hasKey("maxTokens")) maxTokens = options.getInt("maxTokens");
            if (options.hasKey("temperature")) temperature = (float) options.getDouble("temperature");
            if (options.hasKey("topP")) topP = (float) options.getDouble("topP");
        }

        final int finalMaxTokens = maxTokens;
        final float finalTemperature = temperature;
        final float finalTopP = topP;

        AsyncTask.execute(() -> {
            try {
                isGenerating = true;

                // Simplified: generate full text and emit at once
                // In production, llama.cpp callback would emit tokens incrementally
                String result = nativeGenerate(nativeHandle, prompt, finalMaxTokens, finalTemperature, finalTopP);

                WritableMap token = Arguments.createMap();
                token.putString("token", result);
                token.putBoolean("done", true);
                emitEvent("LLMToken", token);

                isGenerating = false;
            } catch (Exception e) {
                isGenerating = false;
                WritableMap error = Arguments.createMap();
                error.putString("error", e.getMessage());
                emitEvent("LLMError", error);
            }
        });
    }

    /**
     * Cancel ongoing generation
     */
    @ReactMethod
    public void cancel() {
        if (isGenerating && nativeHandle != 0) {
            nativeCancelGenerate(nativeHandle);
            isGenerating = false;
        }
    }

    /**
     * Unload model and free memory
     */
    @ReactMethod
    public void unloadModel(Promise promise) {
        if (nativeHandle != 0) {
            nativeDestroy(nativeHandle);
            nativeHandle = 0;
            isModelLoaded = false;
        }
        promise.resolve(true);
    }

    /**
     * Get model info
     */
    @ReactMethod
    public void getModelInfo(Promise promise) {
        if (!isModelLoaded) {
            promise.reject("NOT_LOADED", "No model loaded");
            return;
        }

        try {
            String info = nativeGetModelInfo(nativeHandle);
            WritableMap map = Arguments.createMap();
            map.putString("info", info);
            map.putString("path", modelPath);
            map.putInt("contextSize", contextSize);
            map.putInt("threads", threads);
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Count tokens in text
     */
    @ReactMethod
    public void countTokens(String text, Promise promise) {
        if (!isModelLoaded) {
            promise.reject("NOT_LOADED", "No model loaded");
            return;
        }

        try {
            int count = nativeGetTokenCount(nativeHandle, text);
            promise.resolve(count);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Get current status
     */
    @ReactMethod
    public void getStatus(Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putBoolean("modelLoaded", isModelLoaded);
        map.putBoolean("generating", isGenerating);
        map.putString("modelPath", modelPath != null ? modelPath : "");
        map.putInt("contextSize", contextSize);
        map.putInt("threads", threads);
        promise.resolve(map);
    }

    private void emitEvent(String eventName, WritableMap params) {
        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }
}
