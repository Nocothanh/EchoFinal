/**
 * CalendarService.js - Accesso e gestione calendario
 * Supporta: lettura eventi, creazione, modifica, sincronizzazione
 */

import * as Calendar from 'expo-calendar';
import { logger } from '../utils/Logger';

class CalendarService {
  constructor() {
    this.calendars = [];
    this.events = [];
    this.initialized = false;
  }

  /**
   * Inizializza accesso al calendario
   */
  async init() {
    try {
      const permission = await Calendar.requestCalendarPermissionsAsync();
      if (permission.granted !== true) {
        logger.warn('CalendarService', 'Calendar permissions not granted');
        return false;
      }

      this.calendars = await Calendar.getCalendarsAsync();
      this.initialized = true;
      logger.info('CalendarService', `Loaded ${this.calendars.length} calendars`);
      return true;
    } catch (error) {
      logger.error('CalendarService', 'Initialization failed', error);
      return false;
    }
  }

  /**
   * Carica eventi per data range
   */
  async getEvents(startDate, endDate) {
    try {
      if (this.calendars.length === 0) {
        return [];
      }

      const calendarIds = this.calendars.map(c => c.id);
      const events = await Calendar.getEventsAsync(calendarIds, startDate, endDate);

      return events
        .map(e => ({
          id: e.id,
          title: e.title,
          startDate: new Date(e.startDate),
          endDate: new Date(e.endDate),
          location: e.location,
          notes: e.notes,
          alarms: e.alarms,
        }))
        .sort((a, b) => a.startDate - b.startDate);
    } catch (error) {
      logger.error('CalendarService', 'Failed to load events', error);
      return [];
    }
  }

  /**
   * Ottieni eventi di oggi
   */
  async getTodayEvents() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return this.getEvents(today, tomorrow);
  }

  /**
   * Ottieni prossimi eventi
   */
  async getUpcomingEvents(daysAhead = 7) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.getEvents(today, futureDate);
  }

  /**
   * Crea evento da comando voice
   */
  async createEvent(title, startDate, endDate, details = {}) {
    try {
      if (this.calendars.length === 0) {
        logger.warn('CalendarService', 'No calendars available');
        return null;
      }

      // Usa il primo calendario
      const calendarId = this.calendars[0].id;

      const eventId = await Calendar.createEventAsync(calendarId, {
        title,
        startDate,
        endDate,
        location: details.location,
        notes: details.notes,
        alarms: details.alarms,
      });

      logger.info('CalendarService', 'Event created', { eventId, title });
      return eventId;
    } catch (error) {
      logger.error('CalendarService', 'Failed to create event', error);
      return null;
    }
  }

  /**
   * Carica evento da ID
   */
  async getEventDetails(eventId) {
    try {
      // Carica tutti gli eventi e filtra
      const today = new Date();
      const far = new Date();
      far.setFullYear(far.getFullYear() + 1);

      const events = await this.getEvents(today, far);
      return events.find(e => e.id === eventId);
    } catch (error) {
      logger.error('CalendarService', 'Failed to get event details', error);
      return null;
    }
  }

  /**
   * Aggiorna evento
   */
  async updateEvent(eventId, updates) {
    try {
      await Calendar.updateEventAsync(eventId, updates);
      logger.info('CalendarService', 'Event updated', { eventId });
      return true;
    } catch (error) {
      logger.error('CalendarService', 'Failed to update event', error);
      return false;
    }
  }

  /**
   * Cancella evento
   */
  async deleteEvent(eventId) {
    try {
      await Calendar.deleteEventAsync(eventId);
      logger.info('CalendarService', 'Event deleted', { eventId });
      return true;
    } catch (error) {
      logger.error('CalendarService', 'Failed to delete event', error);
      return false;
    }
  }

  /**
   * Analizza comando voice per creare evento
   * Es: "Crea riunione domani alle 10 con Mario"
   */
  async parseAndCreateEvent(voiceCommand) {
    // Semplice parser (in prod, usare NLP)
    // TODO: Implementare parsing avanzato con regex o NLP
    logger.warn('CalendarService', 'Voice command parsing requires NLP implementation');
    return null;
  }
}

export const calendarService = new CalendarService();
export default CalendarService;
