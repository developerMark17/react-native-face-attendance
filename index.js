import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

// Register the headless task that re-bootstraps the WebRTC livestream
// when the foreground service restarts after the app was killed.
AppRegistry.registerHeadlessTask(
  'LiveStreamHeadlessTask',
  () => require('./src/services/LiveStreamHeadlessTask').default,
);
