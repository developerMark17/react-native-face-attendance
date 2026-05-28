import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';

import CameraScreen from '../screens/CameraScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AttendanceLogScreen from '../screens/AttendanceLogScreen';

const Stack = createNativeStackNavigator();

function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Register" screenOptions={{headerShown: true}}>
        <Stack.Screen name="Register" component={RegisterScreen} options={{title: 'Register Face'}} />
        <Stack.Screen name="Camera" component={CameraScreen} options={{title: 'Mark Attendance'}} />
        <Stack.Screen name="Logs" component={AttendanceLogScreen} options={{title: 'Attendance Logs'}} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;
