import {useCallback, useEffect, useState} from 'react';
import {Camera} from 'react-native-vision-camera';

export default function useCameraPermission() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const requestPermission = useCallback(async () => {
    setIsChecking(true);
    const status = await Camera.requestCameraPermission();
    setHasPermission(status === 'granted');
    setIsChecking(false);
  }, []);

  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  return {hasPermission, isChecking, requestPermission};
}
