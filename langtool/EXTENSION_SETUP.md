# iOS Action Extension Setup Guide

## Manual Setup Required

Since modifying the Xcode project file programmatically is complex, please follow these steps in Xcode to add the Action Extension target:

### 1. Open Xcode Project
```bash
cd /Users/georgebalch/langtools/langtool/ios
open langtool.xcworkspace
```

### 2. Add New Target
1. In Xcode, click on the project name in the navigator
2. Click the "+" button at the bottom of the targets list
3. Select "iOS" → "Application Extension" → "Action Extension"
4. Set the following:
   - Product Name: `LangtoolExtension`
   - Bundle Identifier: `com.langtool.LangtoolExtension`
   - Language: Objective-C
   - Click "Finish"

### 3. Replace Generated Files
The extension files have already been created in `/ios/LangtoolExtension/`:
- `Info.plist` - Extension configuration
- `ActionViewController.h` - Header file
- `ActionViewController.m` - Main implementation
- `MainInterface.storyboard` - UI layout

Replace the auto-generated files with these pre-created ones.

### 4. Extension Features
The Langtool extension will:
- Appear in the system-wide text selection menu as "Langtool"
- Work across ALL iOS apps (Safari, Notes, Messages, etc.)
- Display selected text and log it to console
- Auto-dismiss after processing

### 5. Build and Install
1. Select the LangtoolExtension scheme
2. Build and run on device
3. The extension will be installed system-wide
4. Test by selecting text in any app and choosing "Langtool" from the menu

### 6. Testing
- Open Safari, Notes, or any app with text
- Select some text
- Tap "Share" or look for "Langtool" in the selection menu
- The extension should appear and process the selected text

## Files Created
```
ios/LangtoolExtension/
├── Info.plist              # Extension configuration
├── ActionViewController.h   # Header
├── ActionViewController.m   # Implementation
└── MainInterface.storyboard # UI layout
```

## Notes
- The extension requires a real device for testing (not simulator)
- The main app must be installed first
- Extension appears in Share Sheet and text selection menus
- Works system-wide across all iOS apps