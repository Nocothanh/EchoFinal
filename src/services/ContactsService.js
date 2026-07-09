/**
 * ContactsService.js
 * Search contacts, make calls, and send messages
 */

import * as Contacts from 'expo-contacts';
import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

class ContactsService {
  constructor() {
    this.isInitialized = false;
    this.contacts = [];
  }

  async init() {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') return false;
    this.isInitialized = true;
    return true;
  }

  async getAllContacts() {
    const { data } = await Contacts.getContactsAsync({
      fields: [
        Contacts.Fields.Name,
        Contacts.Fields.PhoneNumbers,
        Contacts.Fields.Emails,
        Contacts.Fields.Addresses,
        Contacts.Fields.Company,
        Contacts.Fields.JobTitle,
        Contacts.Fields.Birthday
      ]
    });
    this.contacts = data;
    return data;
  }

  async searchContacts(query) {
    if (this.contacts.length === 0) await this.getAllContacts();

    const lower = query.toLowerCase();
    return this.contacts.filter(c =>
      c.name?.toLowerCase().includes(lower) ||
      c.company?.toLowerCase().includes(lower) ||
      c.phoneNumbers?.some(p => p.number?.includes(query)) ||
      c.emails?.some(e => e.email?.toLowerCase().includes(lower))
    );
  }

  async getContactByName(name) {
    const results = await this.searchContacts(name);
    return results.length > 0 ? results[0] : null;
  }

  async callContact(name, phoneNumber = null) {
    const contact = await this.getContactByName(name);
    if (!contact) return { success: false, error: `Contact "${name}" not found` };

    const phone = phoneNumber || contact.phoneNumbers?.[0]?.number;
    if (!phone) return { success: false, error: `No phone number for ${name}` };

    try {
      await Linking.openURL(`tel:${phone}`);
      return { success: true, name: contact.name, phone };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async videoCall(name) {
    const contact = await this.getContactByName(name);
    if (!contact) return { success: false, error: `Contact "${name}" not found` };

    const phone = contact.phoneNumbers?.[0]?.number;
    if (!phone) return { success: false, error: `No phone number for ${name}` };

    try {
      if (Platform.OS === 'android') {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: `tel:${phone}`
        });
      } else {
        await Linking.openURL(`facetime:${phone}`);
      }
      return { success: true, name: contact.name };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendEmail(name) {
    const contact = await this.getContactByName(name);
    if (!contact) return { success: false, error: `Contact "${name}" not found` };

    const email = contact.emails?.[0]?.email;
    if (!email) return { success: false, error: `No email for ${name}` };

    try {
      await Linking.openURL(`mailto:${email}`);
      return { success: true, name: contact.name, email };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async openContact(name) {
    const contact = await this.getContactByName(name);
    if (!contact) return { success: false, error: `Contact "${name}" not found` };

    try {
      await Contacts.openContactAsync(contact);
      return { success: true, name: contact.name };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createContact(name, phone, options = {}) {
    try {
      const contactData = {
        [Contacts.Fields.Name]: name,
        [Contacts.Fields.PhoneNumbers]: phone ? [{ number: phone, isPrimary: true }] : [],
        [Contacts.Fields.Emails]: options.email ? [{ email: options.email, isPrimary: true }] : [],
        [Contacts.Fields.Company]: options.company || '',
        [Contacts.Fields.JobTitle]: options.title || ''
      };

      const id = await Contacts.addContactAsync(contactData);
      return { success: true, contactId: id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  formatContact(contact) {
    const phones = contact.phoneNumbers?.map(p => p.number).join(', ') || 'Nessun numero';
    const emails = contact.emails?.map(e => e.email).join(', ') || '';
    return {
      name: contact.name || 'Sconosciuto',
      phone: phones,
      email: emails,
      company: contact.company || '',
      title: contact.jobTitle || ''
    };
  }

  generateContactsSummary(contacts) {
    if (!contacts || contacts.length === 0) return 'Nessun contatto trovato.';
    return contacts.map(c => {
      const f = this.formatContact(c);
      return `• ${f.name} - ${f.phone}`;
    }).join('\n');
  }

  parseContactCommand(text) {
    const lower = text.toLowerCase();
    const commands = {
      call: /(?:call|chiama|telefona a|chiama il)\s+(.+)/i,
      sms: /(?:send.*message.*to|invia messaggio a|scrivi a)\s+(.+)/i,
      email: /(?:email|manda email a|scrivi email a)\s+(.+)/i,
      video_call: /(?:video call|videochiamata|chiama in video)\s+(.+)/i,
      search: /(?:find|trova|cerca|search)\s+(?:contatto\s+)?(.+)/i
    };

    for (const [cmd, regex] of Object.entries(commands)) {
      const match = lower.match(regex);
      if (match) return { command: cmd, name: match[1].trim() };
    }
    return null;
  }

  cleanup() {
    this.contacts = [];
  }
}

export const contactsService = new ContactsService();
export default ContactsService;
