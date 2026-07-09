/**
 * EmailService.js - Servizio Email con Gmail API
 * Integrazione gratuita con Gmail
 */

import { Linking, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { logger } from '../utils/Logger';

// Gmail API endpoints
const GMAIL_API = {
  BASE_URL: 'https://gmail.googleapis.com/gmail/v1',
  AUTH_URL: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_URL: 'https://oauth2.googleapis.com/token',
  SCOPES: [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.labels'
  ].join(' ')
};

// Configurazione OAuth2 (da sostituire con i propri)
const OAUTH_CONFIG = {
  clientId: '', // Client ID da Google Cloud Console
  redirectUri: 'com.nocothanh.echofinal:/oauth2callback',
  clientSecret: '' // Client secret (opzionale per mobile)
};

class EmailServiceClass {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userEmail = null;
    this.isInitialized = false;
    this.labels = [];
  }

  /**
   * Inizializza il servizio email
   */
  async init() {
    try {
      // Carica token salvati
      this.accessToken = await SecureStore.getItemAsync('gmail_access_token');
      this.refreshToken = await SecureStore.getItemAsync('gmail_refresh_token');
      this.userEmail = await SecureStore.getItemAsync('gmail_user_email');

      if (this.accessToken && this.userEmail) {
        this.isInitialized = true;
        logger.info('EmailService', 'Initialized with saved tokens', {
          email: this.userEmail
        });
      } else {
        logger.info('EmailService', 'Initialized, needs authentication');
      }

      return true;
    } catch (error) {
      logger.error('EmailService', 'Failed to initialize', error);
      return false;
    }
  }

  /**
   * Autentica con Gmail
   */
  async authenticate() {
    try {
      // Per mobile, usa Expo AuthSession
      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // Implementazione con Expo AuthSession
        // Per ora, mostriamo istruzioni
        return {
          success: false,
          error: 'Usa il link per autenticarti',
          authUrl: this._buildAuthUrl()
        };
      }

      return { success: false, error: 'Piattaforma non supportata' };
    } catch (error) {
      logger.error('EmailService', 'Authentication failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Costruisci URL di autenticazione
   */
  _buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: OAUTH_CONFIG.clientId,
      redirect_uri: OAUTH_CONFIG.redirectUri,
      response_type: 'code',
      scope: GMAIL_API.SCOPES,
      access_type: 'offline',
      prompt: 'consent'
    });

    return `${GMAIL_API.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Scambia authorization code per token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await fetch(GMAIL_API.TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          code,
          client_id: OAUTH_CONFIG.clientId,
          client_secret: OAUTH_CONFIG.clientSecret,
          redirect_uri: OAUTH_CONFIG.redirectUri,
          grant_type: 'authorization_code'
        }).toString()
      });

      const data = await response.json();

      if (data.access_token) {
        this.accessToken = data.access_token;
        this.refreshToken = data.refresh_token;

        // Salva token
        await SecureStore.setItemAsync('gmail_access_token', data.access_token);
        if (data.refresh_token) {
          await SecureStore.setItemAsync('gmail_refresh_token', data.refresh_token);
        }

        // Ottieni info utente
        await this._fetchUserInfo();

        this.isInitialized = true;
        logger.info('EmailService', 'Authentication successful');

        return { success: true };
      } else {
        return { success: false, error: data.error_description || 'Token exchange failed' };
      }
    } catch (error) {
      logger.error('EmailService', 'Token exchange failed', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ottieni info utente
   */
  async _fetchUserInfo() {
    try {
      const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });

      const data = await response.json();
      this.userEmail = data.emailAddress;
      
      await SecureStore.setItemAsync('gmail_user_email', data.emailAddress);
      
      logger.info('EmailService', 'User info fetched', { email: data.emailAddress });
    } catch (error) {
      logger.error('EmailService', 'Failed to fetch user info', error);
    }
  }

  /**
   * Ottieni email recenti
   */
  async getRecentEmails(maxResults = 10) {
    if (!this.accessToken) {
      return { success: false, error: 'Non autenticato' };
    }

    try {
      // Lista message IDs
      const listResponse = await fetch(
        `${GMAIL_API.BASE_URL}/users/me/messages?maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const listData = await listResponse.json();

      if (!listData.messages) {
        return { success: true, data: [] };
      }

      // Dettagli ogni email
      const emails = await Promise.all(
        listData.messages.map(async (msg) => {
          const msgResponse = await fetch(
            `${GMAIL_API.BASE_URL}/users/me/messages/${msg.id}?format=metadata`,
            {
              headers: {
                'Authorization': `Bearer ${this.accessToken}`
              }
            }
          );
          return msgResponse.json();
        })
      );

      // Trasforma dati
      const transformedEmails = emails.map(email => this._transformEmail(email));

      logger.info('EmailService', 'Fetched recent emails', {
        count: transformedEmails.length
      });

      return { success: true, data: transformedEmails };
    } catch (error) {
      logger.error('EmailService', 'Failed to fetch emails', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Trasforma email Gmail in formato semplice
   */
  _transformEmail(email) {
    const headers = email.payload?.headers || [];
    const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;

    return {
      id: email.id,
      threadId: email.threadId,
      subject: getHeader('Subject') || '(Nessun oggetto)',
      from: getHeader('From') || 'Sconosciuto',
      to: getHeader('To'),
      date: getHeader('Date'),
      snippet: email.snippet || '',
      isUnread: email.labelIds?.includes('UNREAD') || false,
      labels: email.labelIds || [],
      timestamp: email.internalDate ? parseInt(email.internalDate) : Date.now()
    };
  }

  /**
   * Invia email
   */
  async sendEmail(to, subject, body) {
    if (!this.accessToken) {
      return { success: false, error: 'Non autenticato' };
    }

    try {
      // Costruisci email in formato RFC 2822
      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body
      ].join('\r\n');

      // Encode in base64url
      const encodedEmail = Buffer.from(email).toString('base64url');

      const response = await fetch(
        `${GMAIL_API.BASE_URL}/users/me/messages/send`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            raw: encodedEmail
          })
        }
      );

      const data = await response.json();

      if (data.id) {
        logger.info('EmailService', 'Email sent successfully', {
          to,
          subject,
          messageId: data.id
        });
        return { success: true, messageId: data.id };
      } else {
        return { success: false, error: data.error?.message || 'Send failed' };
      }
    } catch (error) {
      logger.error('EmailService', 'Failed to send email', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ottieni email non lette
   */
  async getUnreadEmails(maxResults = 10) {
    if (!this.accessToken) {
      return { success: false, error: 'Non autenticato' };
    }

    try {
      const response = await fetch(
        `${GMAIL_API.BASE_URL}/users/me/messages?q=is:unread&maxResults=${maxResults}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const data = await response.json();

      if (!data.messages) {
        return { success: true, data: [], count: 0 };
      }

      const emails = await Promise.all(
        data.messages.map(async (msg) => {
          const msgResponse = await fetch(
            `${GMAIL_API.BASE_URL}/users/me/messages/${msg.id}?format=metadata`,
            {
              headers: {
                'Authorization': `Bearer ${this.accessToken}`
              }
            }
          );
          return msgResponse.json();
        })
      );

      const transformedEmails = emails.map(email => this._transformEmail(email));

      return {
        success: true,
        data: transformedEmails,
        count: data.resultSizeEstimate || transformedEmails.length
      };
    } catch (error) {
      logger.error('EmailService', 'Failed to fetch unread emails', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Genera briefing email
   */
  generateEmailBriefing(emails) {
    if (!emails || emails.length === 0) {
      return '📧 Nessuna email recente.';
    }

    let briefing = `📧 Hai ${emails.length} email recenti:\n\n`;

    emails.slice(0, 5).forEach((email, index) => {
      const from = email.from.split('<')[0].trim();
      const unread = email.isUnread ? ' (NUOVA)' : '';
      briefing += `${index + 1}. ${from}${unread}: ${email.subject}\n`;
      if (email.snippet) {
        briefing += `   ${email.snippet.substring(0, 50)}...\n`;
      }
    });

    if (emails.length > 5) {
      briefing += `\n... e altre ${emails.length - 5} email.`;
    }

    return briefing;
  }

  /**
   * Conta email non lette
   */
  async getUnreadCount() {
    if (!this.accessToken) {
      return { success: false, count: 0 };
    }

    try {
      const response = await fetch(
        `${GMAIL_API.BASE_URL}/users/me/messages?q=is:unread`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      const data = await response.json();
      return {
        success: true,
        count: data.resultSizeEstimate || 0
      };
    } catch (error) {
      return { success: false, count: 0 };
    }
  }

  /**
   * Apre Gmail app
   */
  async openGmailApp() {
    try {
      const url = Platform.OS === 'ios' ? 'googlegmail://' : 'content://com.google.android.gm/';
      const canOpen = await Linking.canOpenURL(url);
      
      if (canOpen) {
        await Linking.openURL(url);
        return { success: true };
      } else {
        // Fallback: apri browser
        await Linking.openURL('https://mail.google.com');
        return { success: true };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Disconnetti
   */
  async disconnect() {
    try {
      await SecureStore.deleteItemAsync('gmail_access_token');
      await SecureStore.deleteItemAsync('gmail_refresh_token');
      await SecureStore.deleteItemAsync('gmail_user_email');

      this.accessToken = null;
      this.refreshToken = null;
      this.userEmail = null;
      this.isInitialized = false;

      logger.info('EmailService', 'Disconnected');
      return { success: true };
    } catch (error) {
      logger.error('EmailService', 'Failed to disconnect', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Ottieni stato
   */
  getState() {
    return {
      isInitialized: this.isInitialized,
      isAuthenticated: !!this.accessToken,
      userEmail: this.userEmail,
      hasRefreshToken: !!this.refreshToken
    };
  }

  /**
   * Cleanup
   */
  cleanup() {
    this.accessToken = null;
    this.refreshToken = null;
    this.userEmail = null;
    this.labels = [];
    logger.info('EmailService', 'Cleanup completed');
  }
}

export const emailService = new EmailServiceClass();
export default EmailServiceClass;
