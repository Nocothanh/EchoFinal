/**
 * CalendarService.js - Accesso e gestione calendario.
 * Import guardato per essere sicuro in Expo Go / assenza del modulo.
 */

import { logger } from '../utils/Logger';
import { requestCalendarPermission } from '../utils/permissions';

let Calendar = null;
let loadAttempted = false;

async function loadCalendarModule() {
  if (loadAttempted) return Calendar;
  loadAttempted = true;
  try {
    Calendar = await import('expo-calendar');
  } catch (error) {
    logger.warn('CalendarService', 'expo-calendar non disponibile', { error: error?.message });
    Calendar = null;
  }
  return Calendar;
}

class CalendarService {
  constructor() {
    this.calendars = [];
    this.initialized = false;
    this.available = false;
  }

  async isAvailable() {
    return !!(await loadCalendarModule());
  }

  async init() {
    const mod = await loadCalendarModule();
    if (!mod) return false;

    const permission = await requestCalendarPermission();
    if (!permission.granted) {
      logger.warn('CalendarService', 'Calendar permissions not granted');
      return false;
    }

    try {
      this.calendars = await mod.getCalendarsAsync();
      this.initialized = true;
      this.available = true;
      logger.info('CalendarService', `Loaded ${this.calendars.length} calendars`);
      return true;
    } catch (error) {
      logger.error('CalendarService', 'Initialization failed', error);
      return false;
    }
  }

  async getEvents(startDate, endDate) {
    if (!this.initialized) return [];
    const mod = await loadCalendarModule();
    if (!mod) return [];
    try {
      const calendarIds = this.calendars.map((c) => c.id);
      if (calendarIds.length === 0) return [];
      const events = await mod.getEventsAsync(calendarIds, startDate, endDate);
      return (events || []).map((e) => ({
        id: e.id,
        title: e.title,
        startDate: new Date(e.startDate),
        endDate: new Date(e.endDate),
        location: e.location || '',
        notes: e.notes || '',
        allDay: !!e.allDay,
      }));
    } catch (error) {
      logger.error('CalendarService', 'Failed to load events', error);
      return [];
    }
  }

  async createEvent({ title, startDate, endDate, calendarId, notes, location }) {
    if (!this.initialized) return null;
    const mod = await loadCalendarModule();
    if (!mod) return null;
    try {
      const targetCalendar =
        calendarId ||
        this.calendars.find((c) => c.allowsModifications)?.id ||
        this.calendars[0]?.id;
      if (!targetCalendar) return null;
      const id = await mod.createEventAsync(targetCalendar, {
        title,
        startDate,
        endDate,
        notes,
        location,
      });
      return id;
    } catch (error) {
      logger.error('CalendarService', 'Failed to create event', error);
      return null;
    }
  }
}

export const calendarService = new CalendarService();
export default CalendarService;
