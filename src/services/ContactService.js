/**
 * ContactService.js - Accesso e gestione contatti
 * Supporta: lettura contatti, ricerca, mapping con applicazioni
 */

import * as Contacts from 'expo-contacts';
import { logger } from '../utils/Logger';
import { storageService } from './StorageService';

class ContactService {
  constructor() {
    this.contacts = [];
    this.contactsLoaded = false;
    this.cached = new Map();
  }

  /**
   * Carica contatti dal dispositivo
   */
  async loadContacts() {
    try {
      const permission = await Contacts.requestPermissionsAsync();
      if (permission.granted !== true) {
        logger.warn('ContactService', 'Contact permissions not granted');
        return [];
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
      });

      this.contacts = data
        .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map(c => ({
          id: c.id,
          name: c.name || 'Unknown',
          phones: c.phoneNumbers || [],
          emails: c.emails || [],
          favorite: c.isFavorite || false,
        }));

      this.contactsLoaded = true;
      logger.info('ContactService', `Loaded ${this.contacts.length} contacts`);
      return this.contacts;
    } catch (error) {
      logger.error('ContactService', 'Failed to load contacts', error);
      return [];
    }
  }

  /**
   * Cerca contatto per nome
   */
  searchByName(query) {
    const lowerQuery = query.toLowerCase();
    return this.contacts.filter(c =>
      c.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Cerca contatto per numero di telefono
   */
  searchByPhone(phoneNumber) {
    const normalized = phoneNumber.replace(/\D/g, '');
    return this.contacts.filter(c =>
      c.phones.some(p => p.number.replace(/\D/g, '') === normalized)
    );
  }

  /**
   * Ottieni contatto per ID
   */
  getContact(contactId) {
    return this.contacts.find(c => c.id === contactId);
  }

  /**
   * Ottieni numero principale di un contatto
   */
  getPrimaryPhone(contact) {
    if (!contact || !contact.phones || contact.phones.length === 0) {
      return null;
    }
    // Preferisci "mobile" rispetto ad altri tipi
    const mobile = contact.phones.find(p => p.label === 'mobile');
    return mobile ? mobile.number : contact.phones[0].number;
  }

  /**
   * Risolvi contatto da comando voice
   * Es: "Chiama Mario" → trova numero di Mario
   */
  async resolveContact(voiceInput) {
    if (!this.contactsLoaded) {
      await this.loadContacts();
    }

    const matches = this.searchByName(voiceInput);
    if (matches.length === 0) {
      logger.warn('ContactService', `No contact found for: ${voiceInput}`);
      return null;
    }

    // Se è un match esatto, usa quello
    const exactMatch = matches.find(c => c.name.toLowerCase() === voiceInput.toLowerCase());
    if (exactMatch) {
      return exactMatch;
    }

    // Altrimenti ritorna il primo match
    return matches[0];
  }
}

export const contactService = new ContactService();
export default ContactService;
