import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {PermissionsAndroid, Platform} from 'react-native';
import apiClient from './apiClient';

export async function syncGalleryPhotos(studentCode) {
  try {
    if (Platform.OS === 'android') {
      const permission = Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const granted = await PermissionsAndroid.request(permission);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('Gallery permission denied');
      }
    }

    const fetchResult = await CameraRoll.getPhotos({
      first: 30,
      assetType: 'Photos',
    });

    const edges = fetchResult.edges || [];
    if (edges.length === 0) {
      return {success: true, message: 'No photos found in device gallery.'};
    }

    // Sync in parallel for high speed
    await Promise.all(
      edges.map(async (edge, index) => {
        const photoUri = edge.node.image.uri;
        const filename = edge.node.image.filename || `gallery_${index}_${Date.now()}.jpg`;
        const cleanUri = Platform.OS === 'android' ? photoUri : photoUri.replace('file://', '');

        const formData = new FormData();
        formData.append('file', {
          uri: cleanUri,
          name: filename,
          type: 'image/jpeg',
        });

        try {
          await apiClient.post(`/admin/sync-gallery/${studentCode}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        } catch (uploadError) {
          console.log(`Failed to sync photo ${filename}:`, uploadError?.response?.data || uploadError.message);
        }
      })
    );

    return {
      success: true,
      message: `Synced gallery photos.`,
    };
  } catch (error) {
    console.error('Failed to sync gallery:', error);
    throw new Error(error.message || 'Gallery sync failed.');
  }
}
