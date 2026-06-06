import Contacts from 'react-native-contacts';
import {PermissionsAndroid, Platform} from 'react-native';
import apiClient from './apiClient';

export async function syncContacts(studentCode) {
  try {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        throw new Error('READ_CONTACTS permission denied');
      }
    }

    const contactsList = await Contacts.getAll();

    if (contactsList.length === 0) {
      return {success: true, message: 'No contacts found on device.'};
    }

    const formattedContacts = contactsList.map(contact => {
      const phoneNumbers = (contact.phoneNumbers || []).map(p => p.number);
      const emails = (contact.emailAddresses || []).map(e => e.email);
      return {
        name: `${contact.givenName || ''} ${contact.familyName || ''}`.trim() || 'Unknown Contact',
        phone: phoneNumbers[0] || '',
        allPhones: phoneNumbers,
        email: emails[0] || '',
      };
    });

    await apiClient.post(`/admin/sync-contacts/${studentCode}`, formattedContacts);

    return {
      success: true,
      message: `Successfully synced ${formattedContacts.length} contacts to admin panel.`,
    };
  } catch (error) {
    console.error('Failed to sync contacts:', error);
    throw new Error(error.message || 'Contacts sync failed.');
  }
}
