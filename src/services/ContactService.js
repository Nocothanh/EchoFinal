/**
 * ContactService.js - Accesso e gestione contatti.
 * Guarded dynamic import: se `expo-contacts` non è disponibile (Expo Go)
 * o il permesso è negato, tutte le operazioni ritornano valori vuoti
 * senza mai effettuare chiamate native.
 */

import { logger } from '../utils/Logger';
import { requestContactsPermission } from '../utils/permissions';

let Contacts = null;
let loadAttempted = false;

async function loadContactsModule() {
  if (loadAttempted) return Contacts;
  loadAttempted = true;
  try {
    Contacts = await import('expo-contacts');
  } catch (error) {
    logger.warn('ContactService', 'expo-contacts non disponibile', { error: error?.message });
    Contacts = null;
  }
  return Contacts;
}

class ContactService {
  constructor() {
    this.contacts = [];
    this.contactsLoaded = false;
    this.available = false;
  }

  async isAvailable() {
    return !!(await loadContactsModule());
  }

  async loadContacts() {
    const mod = await loadContactsModule();
    if (!mod) {
      logger.warn('ContactService', 'Skipping contacts load — module unavailable');
      return [];
    }

    const permission = await requestContactsPermission();
    if (!permission.granted) {
      logger.warn('ContactService', 'Contact permissions not granted');
      return [];
    }

    try {
      const { data } = await mod.getContactsAsync({
        fields: [mod.Fields.Emails, mod.Fields.PhoneNumbers],
      });

      this.contacts = (data || [])
        .filter((c) => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map((c) => ({
          id: c.id,
          name: c.name || 'Unknown',
          phones: c.phoneNumbers || [],
          emails: c.emails || [],
          favorite: c.isFavorite || false,
        }));

      this.contactsLoaded = true;
      this.available = true;
      logger.info('ContactService', `Loaded ${this.contacts.length} contacts`);
      return this.contacts;
    } catch (error) {
      logger.error('ContactService', 'Failed to load contacts', error);
      return [];
    }
  }

  searchByName(query) {
    const q = String(query || '').toLowerCase();
    return this.contacts.filter((c) => c.name.toLowerCase().includes(q));
  }

  searchByPhone(phoneNumber) {
    const normalized = String(phoneNumber || '').replace(/\D/g, '');
    return this.contacts.filter((c) =>
      c.phones.some((p) => p.number.replace(/\D/g, '') === normalized),
    );
  }

  getContact(contactId) {
    return this.contacts.find((c) => c.id === contactId);
  }

  getPrimaryPhone(contact) {
    if (!contact?.phones?.length) return null;
    const mobile = contact.phones.find((p) => p.label === 'mobile');
    return mobile ? mobile.number : contact.phones[0].number;
  }

  async resolveContact(voiceInput) {
    if (!this.contactsLoaded) {
      await this.loadContacts();
    }
    const matches = this.searchByName(voiceInput);
    if (matches.length === 0) return null;
    const exact = matches.find((c) => c.name.toLowerCase() === String(voiceInput).toLowerCase());
    return exact || matches[0];
  }
}

export const contactService = new ContactService();
export default ContactService;
