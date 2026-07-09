/**
 * TimerService.js
 * Countdown timer, stopwatch, and interval timer with haptic alerts
 */

import * as Haptics from 'expo-haptics';

class TimerService {
  constructor() {
    this.isInitialized = false;
    this.timers = new Map();
    this.intervals = new Map();
    this.stopwatch = { running: false, startTime: 0, elapsed: 0, laps: [] };
    this.timerIdCounter = 0;
    this.listeners = new Map();
  }

  init() {
    this.isInitialized = true;
    return true;
  }

  // --- Countdown Timer ---

  createTimer(name, durationSeconds, options = {}) {
    const id = `timer_${++this.timerIdCounter}`;
    const timer = {
      id,
      name: name || `Timer ${this.timerIdCounter}`,
      totalDuration: durationSeconds,
      remaining: durationSeconds,
      running: false,
      createdAt: Date.now(),
      options: {
        hapticAlert: options.hapticAlert !== false,
        sound: options.sound !== false,
        autoRestart: options.autoRestart || false,
        label: options.label || name
      }
    };
    this.timers.set(id, timer);
    this.notifyListeners('timerCreated', timer);
    return { success: true, timer };
  }

  startTimer(id) {
    const timer = this.timers.get(id);
    if (!timer || timer.running) return { success: false, error: 'Timer not found or already running' };

    timer.running = true;
    timer.startedAt = Date.now();
    timer.intervalId = setInterval(() => {
      if (!timer.running) return;
      timer.remaining--;
      this.notifyListeners('timerTick', { id, remaining: timer.remaining });

      if (timer.remaining <= 0) {
        this.timerComplete(timer);
      }
    }, 1000);

    this.notifyListeners('timerStarted', timer);
    return { success: true, timer };
  }

  pauseTimer(id) {
    const timer = this.timers.get(id);
    if (!timer || !timer.running) return { success: false, error: 'Timer not found or not running' };

    clearInterval(timer.intervalId);
    timer.running = false;
    this.notifyListeners('timerPaused', timer);
    return { success: true, timer };
  }

  resumeTimer(id) {
    const timer = this.timers.get(id);
    if (!timer || timer.running) return { success: false, error: 'Timer not found or already running' };
    return this.startTimer(id);
  }

  resetTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) return { success: false, error: 'Timer not found' };

    clearInterval(timer.intervalId);
    timer.remaining = timer.totalDuration;
    timer.running = false;
    this.notifyListeners('timerReset', timer);
    return { success: true, timer };
  }

  cancelTimer(id) {
    const timer = this.timers.get(id);
    if (!timer) return { success: false, error: 'Timer not found' };

    clearInterval(timer.intervalId);
    this.timers.delete(id);
    this.notifyListeners('timerCancelled', { id });
    return { success: true };
  }

  async timerComplete(timer) {
    clearInterval(timer.intervalId);
    timer.running = false;
    timer.remaining = 0;

    if (timer.options.hapticAlert) {
      for (let i = 0; i < 5; i++) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        await new Promise(r => setTimeout(r, 200));
      }
    }

    this.notifyListeners('timerComplete', timer);

    if (timer.options.autoRestart) {
      timer.remaining = timer.totalDuration;
      this.startTimer(timer.id);
    }
  }

  // --- Stopwatch ---

  startStopwatch() {
    if (this.stopwatch.running) return { success: false, error: 'Already running' };
    this.stopwatch.running = true;
    this.stopwatch.startTime = Date.now() - this.stopwatch.elapsed;
    this.stopwatch.intervalId = setInterval(() => {
      this.stopwatch.elapsed = Date.now() - this.stopwatch.startTime;
      this.notifyListeners('stopwatchTick', { elapsed: this.stopwatch.elapsed });
    }, 50);
    return { success: true };
  }

  stopStopwatch() {
    if (!this.stopwatch.running) return { success: false, error: 'Not running' };
    clearInterval(this.stopwatch.intervalId);
    this.stopwatch.running = false;
    return { success: true, elapsed: this.stopwatch.elapsed };
  }

  resetStopwatch() {
    clearInterval(this.stopwatch.intervalId);
    this.stopwatch = { running: false, startTime: 0, elapsed: 0, laps: [] };
    return { success: true };
  }

  lapStopwatch() {
    if (!this.stopwatch.running) return { success: false, error: 'Not running' };
    const lapTime = this.stopwatch.elapsed;
    const prevLap = this.stopwatch.laps.length > 0 ? this.stopwatch.laps[this.stopwatch.laps.length - 1].time : 0;
    const lap = {
      number: this.stopwatch.laps.length + 1,
      time: lapTime,
      split: lapTime - prevLap
    };
    this.stopwatch.laps.push(lap);
    this.notifyListeners('stopwatchLap', lap);
    return { success: true, lap };
  }

  // --- Interval Timer ---

  createInterval(name, workSeconds, restSeconds, rounds = 5) {
    const id = `interval_${++this.timerIdCounter}`;
    const interval = {
      id,
      name: name || `Interval ${this.timerIdCounter}`,
      workDuration: workSeconds,
      restDuration: restSeconds,
      totalRounds: rounds,
      currentRound: 0,
      phase: 'idle',
      running: false,
      totalElapsed: 0
    };
    this.intervals.set(id, interval);
    return { success: true, interval };
  }

  startInterval(id) {
    const interval = this.intervals.get(id);
    if (!interval) return { success: false, error: 'Interval not found' };
    if (interval.running) return { success: false, error: 'Already running' };

    interval.running = true;
    interval.currentRound = 1;
    interval.phase = 'work';
    let phaseTime = interval.workDuration;

    interval.intervalId = setInterval(async () => {
      phaseTime--;
      interval.totalElapsed++;
      this.notifyListeners('intervalTick', { id, phase: interval.phase, round: interval.currentRound, timeLeft: phaseTime });

      if (phaseTime <= 0) {
        if (interval.phase === 'work') {
          interval.phase = 'rest';
          phaseTime = interval.restDuration;
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          interval.currentRound++;
          if (interval.currentRound > interval.totalRounds) {
            clearInterval(interval.intervalId);
            interval.running = false;
            interval.phase = 'done';
            this.notifyListeners('intervalComplete', { id });
            for (let i = 0; i < 3; i++) {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await new Promise(r => setTimeout(r, 200));
            }
          } else {
            interval.phase = 'work';
            phaseTime = interval.workDuration;
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
        }
      }
    }, 1000);

    this.notifyListeners('intervalStarted', interval);
    return { success: true, interval };
  }

  stopInterval(id) {
    const interval = this.intervals.get(id);
    if (!interval) return { success: false, error: 'Interval not found' };
    clearInterval(interval.intervalId);
    interval.running = false;
    interval.phase = 'idle';
    return { success: true, interval };
  }

  // --- Active Timers ---

  getActiveTimers() {
    return Array.from(this.timers.values()).filter(t => t.running || t.remaining > 0);
  }

  getActiveIntervals() {
    return Array.from(this.intervals.values()).filter(i => i.running);
  }

  // --- Formatting ---

  formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  parseNaturalDuration(text) {
    const lower = text.toLowerCase();
    let totalSeconds = 0;

    const hourMatch = lower.match(/(\d+)\s*(hour|ora|ore)/);
    const minMatch = lower.match(/(\d+)\s*(min|minute|minuti)/);
    const secMatch = lower.match(/(\d+)\s*(sec|second|secondi)/);

    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);

    if (totalSeconds === 0) {
      const numMatch = lower.match(/(\d+)/);
      if (numMatch) totalSeconds = parseInt(numMatch[1]) * 60;
    }

    return totalSeconds;
  }

  // --- Listeners ---

  addListener(callback) {
    const id = `listener_${Date.now()}`;
    this.listeners.set(id, callback);
    return () => this.listeners.delete(id);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try { callback(event, data); } catch (e) {}
    });
  }

  cleanup() {
    this.timers.forEach(t => clearInterval(t.intervalId));
    this.intervals.forEach(i => clearInterval(i.intervalId));
    clearInterval(this.stopwatch.intervalId);
    this.timers.clear();
    this.intervals.clear();
    this.stopwatch = { running: false, startTime: 0, elapsed: 0, laps: [] };
    this.listeners.clear();
  }
}

export const timerService = new TimerService();
export default TimerService;
