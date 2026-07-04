import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'echo_conversation';

class ConversationManager {
  constructor() {
    this.messages = [];
    this.loaded = false;
    this.loadPromise = null;
  }

  async init() {
    if (this.loaded) {
      return this.messages;
    }

    if (!this.loadPromise) {
      this.loadPromise = AsyncStorage.getItem(STORAGE_KEY)
        .then((raw) => {
          if (!raw) {
            this.messages = [];
            this.loaded = true;
            return this.messages;
          }

          try {
            const parsed = JSON.parse(raw);
            this.messages = Array.isArray(parsed) ? parsed.filter(Boolean) : [];
          } catch {
            this.messages = [];
          }

          this.loaded = true;
          return this.messages;
        })
        .catch(() => {
          this.messages = [];
          this.loaded = true;
          return this.messages;
        });
    }

    return this.loadPromise;
  }

  getMessages() {
    return [...this.messages];
  }

  getContextMessages(limit = 12) {
    const maxMessages = Math.max(2, limit);
    return this.messages.slice(-maxMessages);
  }

  async addMessage(message) {
    const normalized = {
      role: message?.role || 'user',
      content: String(message?.content || '').trim(),
    };

    if (!normalized.content) {
      return this.messages;
    }

    this.messages = [...this.messages, normalized];
    await this.persist();
    return this.messages;
  }

  async reset() {
    this.messages = [];
    await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
    return this.messages;
  }

  async persist() {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages));
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }
}

export const conversationManager = new ConversationManager();
export default conversationManager;
