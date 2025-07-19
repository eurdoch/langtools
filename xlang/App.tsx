/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View, NativeModules, AppState, Linking } from 'react-native';

const { SharedDataModule } = NativeModules;

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  const checkForSharedData = async () => {
    try {
      console.log('SharedDataModule available:', !!SharedDataModule);
      if (SharedDataModule) {
        const hasData = await SharedDataModule.hasSharedData();
        console.log('Has shared data:', hasData);
        if (hasData) {
          const sharedData = await SharedDataModule.getSharedData();
          if (sharedData) {
            console.log('=== SHARED DATA RECEIVED ===');
            console.log('Timestamp:', new Date(sharedData.timestamp));
            console.log('Data:', sharedData.data);
            console.log('========================');
          }
        }
      } else {
        console.log('SharedDataModule not found - check if native module is linked');
      }
    } catch (error) {
      console.error('Error checking shared data:', error);
    }
  };

  useEffect(() => {
    checkForSharedData();

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkForSharedData();
      }
    };

    const handleDeepLink = (url: string) => {
      console.log('=== APP OPENED VIA DEEP LINK ===');
      console.log('URL:', url);
      if (url.includes('shared-content')) {
        setTimeout(() => {
          checkForSharedData();
        }, 500);
      }
      console.log('========================');
    };

    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);
    
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    // Handle URLs when app is already running
    const linkingSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      appStateSubscription?.remove();
      linkingSubscription?.remove();
    };
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <NewAppScreen templateFileName="App.tsx" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
