/**
 * EchoAccessibilityService.java
 * Android AccessibilityService that provides screen reading and app control
 */

package com.echoai.accessibility;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.List;

public class EchoAccessibilityService extends AccessibilityService {

    private static final String EVENT_NAME = "EchoAccessibilityEvent";
    private static EchoAccessibilityService instance;
    private Handler mainHandler;
    private ReactApplicationContext reactContext;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
        mainHandler = new Handler(Looper.getMainLooper());

        AccessibilityServiceInfo info = getServiceInfo();
        if (info == null) {
            info = new AccessibilityServiceInfo();
        }

        info.eventTypes = AccessibilityEvent.TYPE_VIEW_CLICKED |
                          AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED |
                          AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED |
                          AccessibilityEvent.TYPE_NOTIFICATION_STATE_CHANGED;

        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_INCLUDE_NOT_IMPORTANT_VIEWS |
                     AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS |
                     AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS;

        info.notificationTimeout = 100;
        setServiceInfo(info);

        EchoAccessibilityModule.setServiceInstance(this);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;

        try {
            WritableMap params = Arguments.createMap();
            params.putInt("eventType", event.getEventType());
            params.putString("className", event.getClassName() != null ?
                event.getClassName().toString() : "");
            params.putString("packageName", event.getPackageName() != null ?
                event.getPackageName().toString() : "");

            CharSequence text = event.getText();
            if (text != null) {
                params.putString("text", text.toString());
            }

            CharSequence desc = event.getContentDescription();
            if (desc != null) {
                params.putString("contentDescription", desc.toString());
            }

            sendEvent(params);
        } catch (Exception e) {
            // Ignore event processing errors
        }
    }

    @Override
    public void onInterrupt() {
        instance = null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        instance = null;
    }

    public static EchoAccessibilityService getInstance() {
        return instance;
    }

    private void sendEvent(WritableMap params) {
        if (reactContext != null && reactContext.hasActiveReactInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(EVENT_NAME, params);
        }
    }

    public void setReactContext(ReactApplicationContext context) {
        this.reactContext = context;
    }
}
