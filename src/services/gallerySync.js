import {CameraRoll} from '@react-native-camera-roll/camera-roll';
import {Platform} from 'react-native';
import apiClient from './apiClient';

export async function syncGalleryPhotos(studentCode) {
  try {
    const fetchResult = await CameraRoll.getPhotos({
      first: 20,
      assetType: 'Photos',
    });

    const edges = fetchResult.edges || [];
    if (edges.length === 0) {
      return {success: true, message: 'No photos found in device gallery.'};
    }

    let successCount = 0;

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const photoUri = edge.node.image.uri;
      const filename = edge.node.image.filename || `gallery_${i}_${Date.now()}.jpg`;

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
        successCount++;
      } catch (uploadError) {
        console.log(`Failed to sync photo ${filename}:`, uploadError?.response?.data || uploadError.message);
      }
    }

    return {
      success: true,
      message: `Synced ${successCount} out of ${edges.length} photos to admin panel.`,
    };
  } catch (error) {
    console.error('Failed to sync gallery:', error);
    throw new Error(error.message || 'Gallery sync failed.');
  }
}
