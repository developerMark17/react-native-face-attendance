# Frontend (React Native CLI)

## Features

- Register screen with front-camera capture and face enrollment
- Attendance screen with live preview and liveness challenge instructions
- Attendance logs screen
- API service layer with Axios
- Reusable components and clean module structure

## Setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Update backend URL in `src/constants/endpoints.js`:

- Set `API_BASE_URL` to your machine LAN IP, for example `http://192.168.1.100:8000`.

3. Run Metro:

```bash
npm start
```

4. Run app:

```bash
npm run android
# or
npm run ios
```

## Native permissions required

### Android

Add these permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

### iOS

Add these keys in `ios/<ProjectName>/Info.plist`:

- `NSCameraUsageDescription`
- `NSLocationWhenInUseUsageDescription`

## Notes

- This project is configured for React Native CLI (not Expo).
- Native folders (`android/`, `ios/`) are already included and ready.
