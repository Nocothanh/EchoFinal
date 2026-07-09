/**
 * MCPBridge.js - WebSocket server for external agent connections
 * Exposes Echo tools over MCP-compatible protocol
 */

import { Platform } from 'react-native';
import { logger } from '../utils/Logger';

const MCP_VERSION = '2024-11-05';
const ECHO_MCP_TOOLS = [
  { name: 'get_weather', description: 'Get current weather', inputSchema: { type: 'object', properties: { city: { type: 'string' } } } },
  { name: 'search_web', description: 'Search the web via DuckDuckGo', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'send_sms', description: 'Send SMS message', inputSchema: { type: 'object', properties: { number: { type: 'string' }, message: { type: 'string' } }, required: ['number', 'message'] } },
  { name: 'make_call', description: 'Make a phone call', inputSchema: { type: 'object', properties: { number: { type: 'string' } }, required: ['number'] } },
  { name: 'read_notifications', description: 'Read recent notifications', inputSchema: { type: 'object', properties: { hours: { type: 'number' } } } },
  { name: 'get_calendar', description: 'Get calendar events', inputSchema: { type: 'object', properties: { days: { type: 'number' } } } },
  { name: 'set_alarm', description: 'Set an alarm', inputSchema: { type: 'object', properties: { time: { type: 'string' }, label: { type: 'string' } }, required: ['time'] } },
  { name: 'open_app', description: 'Open an app', inputSchema: { type: 'object', properties: { app_name: { type: 'string' } }, required: ['app_name'] } },
  { name: 'navigate', description: 'Navigate to destination', inputSchema: { type: 'object', properties: { destination: { type: 'string' } }, required: ['destination'] } },
  { name: 'take_photo', description: 'Take a photo', inputSchema: { type: 'object', properties: {} } },
  { name: 'battery_status', description: 'Get battery status', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_contacts', description: 'Search contacts', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
  { name: 'toggle_flashlight', description: 'Toggle flashlight', inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['on', 'off', 'toggle'] } } } },
  { name: 'set_brightness', description: 'Set screen brightness', inputSchema: { type: 'object', properties: { level: { type: 'number', minimum: 0, maximum: 1 } }, required: ['level'] } },
  { name: 'wellness_breathe', description: 'Start guided breathing', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, duration_minutes: { type: 'number' } } } }
];

class MCPBridgeService {
  constructor() {
    this.isInitialized = false;
    this.isConnected = false;
    this.server = null;
    this.connectedAgents = new Map();
    this.toolHandlers = {};
    this.permissionLevel = 'standard';
  }

  async init() {
    this.isInitialized = true;
    this.registerDefaultHandlers();
    logger.info('MCPBridge', 'Initialized (ready to serve)');
    return true;
  }

  registerDefaultHandlers() {
    this.toolHandlers = {
      'get_weather': async (args) => {
        const { weatherService } = require('./WeatherService');
        return weatherService.getCurrentWeather(args.city);
      },
      'search_web': async (args) => {
        const { webSearchService } = require('./WebSearchService');
        return webSearchService.search(args.query);
      },
      'read_notifications': async (args) => {
        const { notificationTriage } = require('./NotificationTriage');
        return { success: true, data: notificationTriage.getDigestSummary(args.hours || 24) };
      },
      'battery_status': async () => {
        return { success: true, data: { level: 'unknown', charging: false } };
      },
      'toggle_flashlight': async (args) => {
        const { quickActions } = require('./QuickActions');
        return quickActions.toggleFlashlight();
      }
    };
  }

  registerTool(name, handler) {
    this.toolHandlers[name] = handler;
  }

  /**
   * Handle MCP JSON-RPC request
   */
  async handleRequest(request) {
    const { method, params, id } = request;

    switch (method) {
      case 'initialize':
        return this.createResponse(id, {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: 'echo-jarvis',
            version: '3.0.0'
          }
        });

      case 'tools/list':
        return this.createResponse(id, { tools: ECHO_MCP_TOOLS });

      case 'tools/call':
        return await this.handleToolCall(id, params);

      case 'notifications/list':
        return this.createResponse(id, { notifications: [] });

      default:
        return this.createErrorResponse(id, -32601, `Method not found: ${method}`);
    }
  }

  async handleToolCall(id, params) {
    const { name, arguments: args } = params;

    if (!this.toolHandlers[name]) {
      return this.createErrorResponse(id, -32602, `Unknown tool: ${name}`);
    }

    try {
      const result = await this.toolHandlers[name](args || {});
      return this.createResponse(id, {
        content: [{ type: 'text', text: JSON.stringify(result) }]
      });
    } catch (error) {
      return this.createResponse(id, {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      });
    }
  }

  createResponse(id, result) {
    return { jsonrpc: '2.0', id, result };
  }

  createErrorResponse(id, code, message) {
    return { jsonrpc: '2.0', id, error: { code, message } };
  }

  getTools() {
    return ECHO_MCP_TOOLS;
  }

  getStatus() {
    return {
      initialized: this.isInitialized,
      connected: this.isConnected,
      agentCount: this.connectedAgents.size,
      toolCount: Object.keys(this.toolHandlers).length,
      permissionLevel: this.permissionLevel
    };
  }

  setPermissionLevel(level) {
    this.permissionLevel = level;
  }
}

export const mcpBridge = new MCPBridgeService();
export default MCPBridgeService;
