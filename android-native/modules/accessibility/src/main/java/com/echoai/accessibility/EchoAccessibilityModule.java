/**
 * EchoAccessibilityModule.java
 * React Native bridge for Android AccessibilityService
 * Enables screen reading, app control, and UI interaction
 */

package com.echoai.accessibility;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityManager;
import android.view.accessibility.AccessibilityNodeInfo;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.util.List;

public class EchoAccessibilityModule extends ReactContextBaseJavaModule {

    private static final String MODULE_NAME = "EchoAccessibility";
    private EchoAccessibilityService serviceInstance;

    public EchoAccessibilityModule(ReactApplicationContext context) {
        super(context);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /**
     * Check if accessibility service is enabled
     */
    @ReactMethod
    public void isEnabled(Promise promise) {
        try {
            AccessibilityManager am = (AccessibilityManager)
                getReactApplicationContext().getSystemService(Context.ACCESSIBILITY_SERVICE);
            boolean enabled = am != null && am.isEnabled();
            promise.resolve(enabled);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Open accessibility settings
     */
    @ReactMethod
    public void openSettings() {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getReactApplicationContext().startActivity(intent);
    }

    /**
     * Get current screen content (read screen)
     */
    @ReactMethod
    public void getScreenContent(Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service == null) {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
                return;
            }

            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) {
                promise.resolve("");
                return;
            }

            StringBuilder sb = new StringBuilder();
            traverseNode(root, sb, 0);
            root.recycle();

            promise.resolve(sb.toString());
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Find element by text
     */
    @ReactMethod
    public void findElement(String text, Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service == null) {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
                return;
            }

            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) {
                promise.resolve(null);
                return;
            }

            List<AccessibilityNodeInfo> nodes = root.findAccessibilityNodeInfosByText(text);
            WritableArray results = Arguments.createArray();

            if (nodes != null) {
                for (AccessibilityNodeInfo node : nodes) {
                    WritableMap map = Arguments.createMap();
                    map.putString("text", node.getText() != null ? node.getText().toString() : "");
                    map.putString("desc", node.getContentDescription() != null ?
                        node.getContentDescription().toString() : "");
                    map.putString("class", node.getClassName() != null ?
                        node.getClassName().toString() : "");
                    map.putBoolean("clickable", node.isClickable());
                    map.putBoolean("focusable", node.isFocusable());

                    int[] bounds = new int[2];
                    node.getBoundsInScreen(new android.graphics.Rect());
                    android.graphics.Rect rect = new android.graphics.Rect();
                    node.getBoundsInScreen(rect);
                    map.putDouble("x", rect.left);
                    map.putDouble("y", rect.top);
                    map.putDouble("width", rect.width());
                    map.putDouble("height", rect.height());

                    results.pushMap(map);
                    node.recycle();
                }
            }

            root.recycle();
            promise.resolve(results);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Tap on screen coordinates
     */
    @ReactMethod
    public void tap(double x, double y, Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service == null) {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
                return;
            }

            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root == null) {
                promise.reject("NO_ROOT", "Cannot get root node");
                return;
            }

            AccessibilityNodeInfo target = findNodeAtCoordinates(root, (int) x, (int) y);
            root.recycle();

            if (target != null) {
                boolean clicked = target.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                target.recycle();
                promise.resolve(clicked);
            } else {
                promise.reject("NOT_FOUND", "No element found at coordinates");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Type text into focused element
     */
    @ReactMethod
    public void typeText(String text, Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service == null) {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
                return;
            }

            AccessibilityNodeInfo focused = service.findFocus(
                android.view.accessibility.AccessibilityNodeInfo.FOCUS_ACCESSIBILITY);
            if (focused != null) {
                Bundle args = new Bundle();
                args.putCharSequence(
                    android.view.accessibility.AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                    text);
                boolean result = focused.performAction(
                    android.view.accessibility.AccessibilityNodeInfo.ACTION_SET_TEXT, args);
                focused.recycle();
                promise.resolve(result);
            } else {
                promise.reject("NO_FOCUS", "No focused element");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Scroll down
     */
    @ReactMethod
    public void scrollDown(Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service == null) {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
                return;
            }

            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            if (root != null) {
                boolean result = root.performAction(AccessibilityNodeInfo.ACTION_SCROLL_FORWARD);
                root.recycle();
                promise.resolve(result);
            } else {
                promise.resolve(false);
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Go back
     */
    @ReactMethod
    public void goBack(Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service != null) {
                boolean result = service.performGlobalAction(
                    android.view.accessibility.AccessibilityService.GLOBAL_ACTION_BACK);
                promise.resolve(result);
            } else {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Go home
     */
    @ReactMethod
    public void goHome(Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service != null) {
                boolean result = service.performGlobalAction(
                    android.view.accessibility.AccessibilityService.GLOBAL_ACTION_HOME);
                promise.resolve(result);
            } else {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Open notification shade
     */
    @ReactMethod
    public void openNotifications(Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service != null) {
                boolean result = service.performGlobalAction(
                    android.view.accessibility.AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS);
                promise.resolve(result);
            } else {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
            }
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    /**
     * Get list of running apps
     */
    @ReactMethod
    public void getRunningApps(Promise promise) {
        try {
            EchoAccessibilityService service = getServiceInstance();
            if (service == null) {
                promise.reject("NOT_RUNNING", "Accessibility service not running");
                return;
            }

            AccessibilityNodeInfo root = service.getRootInActiveWindow();
            WritableArray apps = Arguments.createArray();

            if (root != null) {
                traverseForApps(root, apps);
                root.recycle();
            }

            promise.resolve(apps);
        } catch (Exception e) {
            promise.reject("ERROR", e.getMessage());
        }
    }

    // Helper methods

    private void traverseNode(AccessibilityNodeInfo node, StringBuilder sb, int depth) {
        if (node == null) return;

        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();

        if (text != null && text.length() > 0) {
            sb.append("  ".repeat(depth)).append(text).append("\n");
        } else if (desc != null && desc.length() > 0) {
            sb.append("  ".repeat(depth)).append("[").append(desc).append("]\n");
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                traverseNode(child, sb, depth + 1);
                child.recycle();
            }
        }
    }

    private AccessibilityNodeInfo findNodeAtCoordinates(AccessibilityNodeInfo node, int x, int y) {
        if (node == null) return null;

        android.graphics.Rect rect = new android.graphics.Rect();
        node.getBoundsInScreen(rect);

        if (rect.contains(x, y)) {
            for (int i = 0; i < node.getChildCount(); i++) {
                AccessibilityNodeInfo child = node.getChild(i);
                if (child != null) {
                    AccessibilityNodeInfo result = findNodeAtCoordinates(child, x, y);
                    child.recycle();
                    if (result != null) return result;
                }
            }
            return AccessibilityNodeInfo.obtain(node);
        }

        return null;
    }

    private void traverseForApps(AccessibilityNodeInfo node, WritableArray apps) {
        if (node == null) return;

        CharSequence pkg = node.getPackageName();
        if (pkg != null) {
            String pkgName = pkg.toString();
            boolean found = false;
            for (int i = 0; i < apps.size(); i++) {
                if (apps.getString(i).equals(pkgName)) {
                    found = true;
                    break;
                }
            }
            if (!found) apps.pushString(pkgName);
        }

        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                traverseForApps(child, apps);
                child.recycle();
            }
        }
    }

    static void setServiceInstance(EchoAccessibilityService service) {
        instance = service;
    }

    private static EchoAccessibilityService instance;

    private EchoAccessibilityService getServiceInstance() {
        return instance;
    }
}
