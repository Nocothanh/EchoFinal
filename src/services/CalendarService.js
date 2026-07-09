/**
 * CalendarService.js
 * Read/create events, agenda, and reminders using expo-calendar
 */

import * as Calendar from 'expo-calendar';

class CalendarService {
  constructor() {
    this.isInitialized = false;
    this calendars = [];
    this.defaultCalendarId = null;
  }

  async init() {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    if (status !== 'granted') {
      return false;
    }
    this.calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    this.defaultCalendarId = this.calendars.find(c => c.allowsModifications)?.id || this.calendars[0]?.id;
    this.isInitialized = true;
    return true;
  }

  async getCalendars() {
    this.calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    return this.calendars;
  }

  async getTodayEvents() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const events = await Calendar.getEventsAsync(
      this.calendars.map(c => c.id),
      start,
      end
    );

    return events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }

  async getUpcomingEvents(days = 7) {
    const start = new Date();
    const end = new Date();
    end.setDate(end.getDate() + days);

    const events = await Calendar.getEventsAsync(
      this.calendars.map(c => c.id),
      start,
      end
    );

    return events.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  }

  async getEventById(eventId) {
    return Calendar.getEventAsync(eventId);
  }

  async searchEvents(query) {
    const events = await this.getUpcomingEvents(30);
    const lower = query.toLowerCase();
    return events.filter(e =>
      e.title?.toLowerCase().includes(lower) ||
      e.location?.toLowerCase().includes(lower) ||
      e.notes?.toLowerCase().includes(lower)
    );
  }

  async createEvent(title, startDate, endDate, options = {}) {
    const calendarId = options.calendarId || this.defaultCalendarId;
    if (!calendarId) return { success: false, error: 'No writable calendar found' };

    const eventId = await Calendar.createEventAsync(calendarId, {
      title,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      location: options.location || '',
      notes: options.notes || '',
      allDay: options.allDay || false,
      alarms: options.alarms || [{ relativeOffset: -15 }],
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    });

    return { success: true, eventId };
  }

  async createEventInMinutes(title, minutesFromNow, durationMinutes = 60, options = {}) {
    const start = new Date(Date.now() + minutesFromNow * 60000);
    const end = new Date(start.getTime() + durationMinutes * 60000);
    return this.createEvent(title, start, end, options);
  }

  async updateEvent(eventId, updates) {
    try {
      await Calendar.updateEventAsync(eventId, {
        title: updates.title,
        location: updates.location,
        notes: updates.notes,
        startDate: updates.startDate ? new Date(updates.startDate) : undefined,
        endDate: updates.endDate ? new Date(updates.endDate) : undefined
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteEvent(eventId) {
    try {
      await Calendar.deleteEventAsync(eventId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAgenda() {
    const today = await this.getTodayEvents();
    const tomorrow = await this.getUpcomingEvents(1);

    const tomorrowStart = new Date();
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    const tomorrowEvents = await Calendar.getEventsAsync(
      this.calendars.map(c => c.id),
      tomorrowStart,
      tomorrowEnd
    );

    return {
      today,
      tomorrow: tomorrowEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    };
  }

  formatEvent(event) {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const timeStr = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const dateStr = start.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    const duration = Math.round((end - start) / 60000);

    return {
      title: event.title,
      time: timeStr,
      date: dateStr,
      duration: `${duration} min`,
      location: event.location || '',
      notes: event.notes || '',
      allDay: event.allDay
    };
  }

  generateAgendaSummary(events) {
    if (!events || events.length === 0) return 'Nessun evento in programma.';

    const lines = events.map(e => {
      const formatted = this.formatEvent(e);
      const time = e.allDay ? 'Tutto il giorno' : formatted.time;
      const location = formatted.location ? ` 📍 ${formatted.location}` : '';
      return `• ${time} - ${formatted.title}${location}`;
    });

    return `📅 Agenda (${events.length} eventi):\n\n${lines.join('\n')}`;
  }

  parseNaturalDate(text) {
    const lower = text.toLowerCase();
    const now = new Date();
    const result = { start: new Date(), end: new Date() };

    if (/domani|tomorrow/i.test(lower)) {
      result.start.setDate(result.start.getDate() + 1);
      result.end.setDate(result.end.getDate() + 1);
    } else if (/dopodomani|day after tomorrow/i.test(lower)) {
      result.start.setDate(result.start.getDate() + 2);
      result.end.setDate(result.end.getDate() + 2);
    } else if (/lunedì|monday/i.test(lower)) {
      const diff = (1 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    } else if (/martedì|tuesday/i.test(lower)) {
      const diff = (2 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    } else if (/mercoledì|wednesday/i.test(lower)) {
      const diff = (3 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    } else if (/giovedì|thursday/i.test(lower)) {
      const diff = (4 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    } else if (/venerdì|friday/i.test(lower)) {
      const diff = (5 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    } else if (/sabato|saturday/i.test(lower)) {
      const diff = (6 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    } else if (/domenica|sunday/i.test(lower)) {
      const diff = (0 - now.getDay() + 7) % 7 || 7;
      result.start.setDate(result.start.getDate() + diff);
      result.end.setDate(result.end.getDate() + diff);
    }

    const hourMatch = lower.match(/(?:ore|at|alle)\s*(\d{1,2})[:\s]*(\d{2})?/);
    if (hourMatch) {
      result.start.setHours(parseInt(hourMatch[1]), parseInt(hourMatch[2] || '0'), 0, 0);
      result.end = new Date(result.start.getTime() + 60 * 60 * 1000);
    }

    const durationMatch = lower.match(/per\s+(\d+)\s*(min|minuti|hour|ore)/);
    if (durationMatch) {
      const val = parseInt(durationMatch[1]);
      const unit = durationMatch[2];
      const ms = unit.startsWith('hour') || unit.startsWith('ore') ? val * 3600000 : val * 60000;
      result.end = new Date(result.start.getTime() + ms);
    }

    return result;
  }

  cleanup() {
    this.calendars = [];
  }
}

export const calendarService = new CalendarService();
export default CalendarService;
