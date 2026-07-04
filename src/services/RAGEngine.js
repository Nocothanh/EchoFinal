/**
 * RAGEngine.js - Retrieval-Augmented Generation per contesto profondo
 * Implementa: ricerca semantica su conversazioni passate, memory augmentation
 */

import { storageService } from './StorageService';
import { logger } from '../utils/Logger';

class RAGEngine {
  constructor() {
    this.embeddings = new Map();
    this.maxRetrievedItems = 5;
  }

  /**
   * Genera embedding semplice basato su word frequency
   * In produzione, usare modelli più sofisticati (Sentence-BERT, etc.)
   */
  async generateEmbedding(text) {
    // Simple bag-of-words embedding per demo
    const words = text.toLowerCase().split(/\s+/);
    const embedding = {};
    words.forEach(word => {
      embedding[word] = (embedding[word] || 0) + 1;
    });
    return embedding;
  }

  /**
   * Calcola similarità coseno tra due embedding
   */
  cosineSimilarity(emb1, emb2) {
    const allKeys = new Set([...Object.keys(emb1), ...Object.keys(emb2)]);
    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (const key of allKeys) {
      const val1 = emb1[key] || 0;
      const val2 = emb2[key] || 0;
      dotProduct += val1 * val2;
      mag1 += val1 * val1;
      mag2 += val2 * val2;
    }

    if (mag1 === 0 || mag2 === 0) return 0;
    return dotProduct / (Math.sqrt(mag1) * Math.sqrt(mag2));
  }

  /**
   * Recupera messaggi rilevanti dalla history
   */
  async retrieveRelevantMessages(userId, query, limit = 5) {
    try {
      // Genera embedding della query
      const queryEmbedding = await this.generateEmbedding(query);

      // Recupera messaggi recenti da database
      const messages = await storageService.db.getAllAsync(
        `SELECT m.* FROM messages m
         JOIN conversations c ON m.conversationId = c.id
         WHERE c.userId = ? AND m.timestamp > datetime('now', '-30 days')
         ORDER BY m.timestamp DESC`,
        [userId]
      );

      // Calcola similarità
      const scored = await Promise.all(
        messages.map(async (msg) => ({
          ...msg,
          similarity: await this.cosineSimilarity(queryEmbedding, await this.generateEmbedding(msg.content)),
        }))
      );

      // Ordina per similarità e ritorna top-k
      return scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit || this.maxRetrievedItems)
        .filter(m => m.similarity > 0.1);
    } catch (error) {
      logger.error('RAGEngine', 'Retrieval failed', error);
      return [];
    }
  }

  /**
   * Costruisci contesto aumentato per LLM
   */
  async buildAugmentedContext(userId, userMessage) {
    try {
      const relevantMessages = await this.retrieveRelevantMessages(userId, userMessage, 3);

      if (relevantMessages.length === 0) {
        return '';
      }

      const context = relevantMessages
        .map(m => `[${m.timestamp}] ${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      return `Relevant conversation history:\n${context}\n---\n`;
    } catch (error) {
      logger.error('RAGEngine', 'Context building failed', error);
      return '';
    }
  }

  /**
   * Cerca conversazioni per topic
   */
  async searchByTopic(userId, topic) {
    try {
      return await storageService.searchConversations(userId, topic);
    } catch (error) {
      logger.error('RAGEngine', 'Topic search failed', error);
      return [];
    }
  }

  /**
   * Estrai entità e topics da messaggio
   */
  async extractTopics(text) {
    // Semplice estrazione di keywords
    const stopwords = new Set([
      'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'di', 'da', 'per',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'from',
    ]);

    const words = text.toLowerCase().split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    return [...new Set(words)].slice(0, 5); // Top 5 keywords
  }
}

export const ragEngine = new RAGEngine();
export default RAGEngine;
