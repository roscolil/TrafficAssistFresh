import React, {useEffect} from 'react';
import {SafeAreaView, StatusBar, View, Text} from 'react-native';
import {flags} from './config/flags';

// Re-enable native modules gradually for testing
const ENABLE_NATIVE_MODULES = true;
const ENABLE_CAMERA = true; // Re-enable camera with safer version
const ENABLE_CONNECTIVITY_CHECK = true;

// Safe import for KeepAwake
let KeepAwake: any = () => null; // Default to no-op component
if (ENABLE_NATIVE_MODULES) {
  try {
    KeepAwake = require('react-native-keep-awake').default;
  } catch (error) {
    console.warn('react-native-keep-awake not available:', error);
    KeepAwake = () => null;
  }
}

// Safe imports for components
let CameraView: any = MinimalCameraView;
let ConnectivityCheck: any = MinimalConnectivityCheck;

if (ENABLE_CAMERA) {
  try {
    CameraView = require('./camera/CameraView').default;
  } catch (error) {
    console.warn('CameraView not available:', error);
    CameraView = MinimalCameraView;
  }
}

if (ENABLE_CONNECTIVITY_CHECK) {
  try {
    ConnectivityCheck = require('./dev/ConnectivityCheck').default;
  } catch (error) {
    console.warn('ConnectivityCheck not available:', error);
    ConnectivityCheck = MinimalConnectivityCheck;
  }
}

// Minimal CameraView fallback
function MinimalCameraView() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'black',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
      <Text style={{color: 'white', textAlign: 'center', padding: 20}}>
        Camera View Disabled for Testing{'\n'}
        (Enable ENABLE_CAMERA to restore functionality)
      </Text>
    </View>
  );
}

// Minimal ConnectivityCheck fallback
function MinimalConnectivityCheck() {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        right: 20,
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: 12,
        borderRadius: 12,
      }}>
      <Text style={{color: 'white', fontWeight: '600'}}>
        Connectivity Check Disabled
      </Text>
    </View>
  );
}

export default function App() {
  useEffect(() => {
    // Safely load intersection pack
    try {
      const loadIntersectionPack =
        require('./map/intersectionPack').loadIntersectionPack;
      loadIntersectionPack(flags.intersectionPackUrl).catch(() => {});
    } catch (error) {
      console.warn('Failed to load intersection pack:', error);
    }
  }, []);

  return (
    <SafeAreaView style={{flex: 1, backgroundColor: 'black'}}>
      <StatusBar barStyle="light-content" />
      <KeepAwake />
      <View style={{flex: 1}}>
        <CameraView />
        <View
          style={{
            position: 'absolute',
            top: 12,
            alignSelf: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
          }}>
          <Text style={{color: 'white'}}>
            Traffic Assist (Hybrid: Edge + Cloud)
          </Text>
        </View>
        <ConnectivityCheck />
      </View>
    </SafeAreaView>
  );
}
