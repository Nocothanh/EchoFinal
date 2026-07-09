/**
 * EchoWakeWordPackage.java
 * React Native package registration for Wake Word module
 */

package com.echoai.wakeword;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class EchoWakeWordPackage implements ReactPackage {

    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext context) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new EchoWakeWordModule(context));
        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext context) {
        return Collections.emptyList();
    }
}
