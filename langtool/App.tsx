/**
 * React Native App with Text Selection Menu
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Text, ScrollView, Alert, NativeModules, NativeEventEmitter } from 'react-native';

const { LangtoolTextSelection } = NativeModules;

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    // Setup the native text selection menu
    if (LangtoolTextSelection) {
      LangtoolTextSelection.setupTextSelection();
      
      // Listen for text selection events
      const eventEmitter = new NativeEventEmitter(LangtoolTextSelection);
      const subscription = eventEmitter.addListener('onTextSelected', (event) => {
        const selectedText = event.text;
        console.log('Langtool selected text:', selectedText);
        Alert.alert('Langtool', `Selected text: ${selectedText}`);
      });
      
      return () => {
        subscription.remove();
      };
    }
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: isDarkMode ? '#fff' : '#000' }]}>
            Text Selection Demo
          </Text>
          <Text 
            style={[styles.paragraph, { color: isDarkMode ? '#ccc' : '#333' }]}
            selectable={true}
          >
            This is a sample React Native app that demonstrates text selection functionality. 
            Select any text in this app to see the "Langtool" option appear in the system text selection menu.
          </Text>
          <Text 
            style={[styles.paragraph, { color: isDarkMode ? '#ccc' : '#333' }]}
            selectable={true}
          >
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor 
            incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis 
            nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
          </Text>
          <Text 
            style={[styles.paragraph, { color: isDarkMode ? '#ccc' : '#333' }]}
            selectable={true}
          >
            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore 
            eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, 
            sunt in culpa qui officia deserunt mollit anim id est laborum.
          </Text>
          <Text 
            style={[styles.paragraph, { color: isDarkMode ? '#ccc' : '#333' }]}
            selectable={true}
          >
            Try selecting any portion of this text to see the native "Langtool" option appear 
            in the iOS text selection menu. The selected text will be logged and displayed.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 60,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 16,
    textAlign: 'justify',
  },
});

export default App;
