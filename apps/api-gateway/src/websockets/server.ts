import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createAuthContext } from '@hyperdash/contracts';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: any;
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp: string;
  requestId?: string;
}

export interface RoomSubscription {
  userId: string;
  socketId: string;
  room: string;
  subscribedAt: Date;
}

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  messagesPerSecond: number;
  lastMinuteMessages: number;
}

class WebSocketManager {
  private io: SocketIOServer | null = null;
  private connectedClients = new Map<string, AuthenticatedSocket>();
  private roomSubscriptions = new Map<string, Set<string>>(); // room -> Set of socketIds
  private socketRooms = new Map<string, Set<string>>(); // socketId -> Set of rooms
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    totalMessages: 0,
    messagesPerSecond: 0,
    lastMinuteMessages: 0,
  };
  private messageHistory: Array<{ timestamp: number; count: number }> = [];

  constructor() {
    // Clean up old message history every minute
    setInterval(() => {
      this.cleanupMessageHistory();
    }, 60000);
  }

  initialize(server: HTTPServer): void {
    if (this.io) {
      console.warn('WebSocket server already initialized');
      return;
    }

    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      maxHttpBufferSize: 1e6, // 1MB
      compression: true,
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    console.log('✅ WebSocket server initialized');
  }

  private setupMiddleware(): void {
    if (!this.io) return;

    // Authentication middleware
    this.io.use(async (socket: any, next) => {
      try {
        const token = socket.handshake.auth.token ||
                     socket.handshake.headers.authorization?.replace('Bearer ', '');

        if (!token) {
          return next(new Error('Authentication required'));
        }

        const user = await createAuthContext(token);
        (socket as AuthenticatedSocket).userId = user.userId;
        (socket as AuthenticatedSocket).user = user;

        next();
      } catch (error) {
        console.error('WebSocket authentication failed:', error);
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware
    this.io.use((socket: any, next) => {
      const ip = socket.handshake.address;
      // Add rate limiting logic here if needed
      next();
    });
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });

    console.log('✅ WebSocket event handlers configured');
  }

  private handleConnection(socket: AuthenticatedSocket): void {
    const { userId, user } = socket;

    console.log(`🔌 WebSocket client connected: ${socket.id} (user: ${userId})`);

    // Update metrics
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    // Store connected client
    this.connectedClients.set(socket.id, socket);
    this.socketRooms.set(socket.id, new Set());

    // Join user-specific room
    socket.join(`user:${userId}`);
    this.addToRoom(`user:${userId}`, socket.id);

    // Send welcome message
    socket.emit('connected', {
      type: 'connection_established',
      data: {
        socketId: socket.id,
        userId,
        serverTime: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });

    // Setup event handlers for this socket
    this.setupSocketEventHandlers(socket);

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(socket, reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  }

  private setupSocketEventHandlers(socket: AuthenticatedSocket): void {
    // Join room subscription
    socket.on('subscribe', (data: { room: string; params?: any }) => {
      this.handleSubscription(socket, data.room, data.params);
    });

    // Leave room subscription
    socket.on('unsubscribe', (data: { room: string }) => {
      this.handleUnsubscription(socket, data.room);
    });

    // Handle client messages
    socket.on('message', (message: WebSocketMessage) => {
      this.handleClientMessage(socket, message);
    });

    // Heartbeat/ping
    socket.on('ping', () => {
      socket.emit('pong', {
        type: 'pong',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private handleSubscription(socket: AuthenticatedSocket, room: string, params?: any): void {
    try {
      // Validate room name and permissions
      if (!this.isValidRoom(room, socket.user)) {
        socket.emit('error', {
          type: 'subscription_error',
          data: { room, message: 'Invalid room or insufficient permissions' },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Join room
      socket.join(room);
      this.addToRoom(room, socket.id);

      console.log(`📡 User ${socket.userId} subscribed to room: ${room}`);

      // Send confirmation
      socket.emit('subscribed', {
        type: 'subscription_confirmed',
        data: { room, params },
        timestamp: new Date().toISOString(),
      });

      // Notify other users in the room (if applicable)
      socket.to(room).emit('user_joined', {
        type: 'user_joined_room',
        data: {
          userId: socket.userId,
          room,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Subscription error for room ${room}:`, error);
      socket.emit('error', {
        type: 'subscription_error',
        data: { room, message: 'Failed to subscribe to room' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleUnsubscription(socket: AuthenticatedSocket, room: string): void {
    try {
      socket.leave(room);
      this.removeFromRoom(room, socket.id);

      console.log(`📡 User ${socket.userId} unsubscribed from room: ${room}`);

      socket.emit('unsubscribed', {
        type: 'unsubscription_confirmed',
        data: { room },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      console.error(`Unsubscription error for room ${room}:`, error);
    }
  }

  private handleClientMessage(socket: AuthenticatedSocket, message: WebSocketMessage): void {
    try {
      // Update metrics
      this.metrics.totalMessages++;
      this.updateMessageMetrics();

      // Add metadata
      const enhancedMessage: WebSocketMessage = {
        ...message,
        timestamp: new Date().toISOString(),
      };

      console.log(`📨 Message from ${socket.userId}:`, message.type);

      // Route message based on type
      this.routeMessage(enhancedMessage, socket);

    } catch (error) {
      console.error(`Error handling message from ${socket.id}:`, error);
      socket.emit('error', {
        type: 'message_processing_error',
        data: { originalMessage: message },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private routeMessage(message: WebSocketMessage, senderSocket: AuthenticatedSocket): void {
    switch (message.type) {
      case 'market_subscribe':
        // Route to market data service
        this.emitToService('market-service', message, senderSocket);
        break;

      case 'trader_subscribe':
        // Route to trader service
        this.emitToService('trader-service', message, senderSocket);
        break;

      case 'strategy_update':
        // Route to strategy service
        this.emitToService('strategy-service', message, senderSocket);
        break;

      case 'ping':
        senderSocket.emit('pong', {
          type: 'pong',
          data: { timestamp: new Date().toISOString() },
          timestamp: new Date().toISOString(),
        });
        break;

      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    console.log(`🔌 WebSocket client disconnected: ${socket.id} (user: ${socket.userId}) - Reason: ${reason}`);

    // Update metrics
    this.metrics.activeConnections--;

    // Remove from connected clients
    this.connectedClients.delete(socket.id);

    // Remove from all rooms
    const userRooms = this.socketRooms.get(socket.id);
    if (userRooms) {
      for (const room of userRooms) {
        this.removeFromRoom(room, socket.id);
      }
      this.socketRooms.delete(socket.id);
    }

    // Notify services about disconnection
    this.emitToService('connection-service', {
      type: 'user_disconnected',
      data: {
        userId: socket.userId,
        socketId: socket.id,
        reason,
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
  }

  // Broadcasting methods
  broadcast(message: WebSocketMessage, room?: string): void {
    if (!this.io) return;

    if (room) {
      this.io.to(room).emit('broadcast', message);
      console.log(`📢 Broadcast to room ${room}:`, message.type);
    } else {
      this.io.emit('broadcast', message);
      console.log(`📢 Global broadcast:`, message.type);
    }
  }

  sendToUser(userId: string, message: WebSocketMessage): void {
    if (!this.io) return;

    this.io.to(`user:${userId}`).emit('message', message);
    console.log(`📨 Sent message to user ${userId}:`, message.type);
  }

  sendToSocket(socketId: string, message: WebSocketMessage): void {
    const socket = this.connectedClients.get(socketId);
    if (socket) {
      socket.emit('message', message);
      console.log(`📨 Sent message to socket ${socketId}:`, message.type);
    }
  }

  // Room management
  private isValidRoom(room: string, user: any): boolean {
    // Validate room patterns and permissions
    const validPatterns = [
      /^market:[A-Za-z0-9_-]+$/, // Market data rooms
      /^trader:[A-Za-z0-9_-]+$/, // Trader rooms
      /^strategy:[A-Za-z0-9_-]+$/, // Strategy rooms
      /^user:[A-Za-z0-9_-]+$/, // User-specific rooms
      /^notifications$/, // Global notifications
      /^risk_alerts$/, // Risk alerts
    ];

    // Check if room matches any valid pattern
    const isValidPattern = validPatterns.some(pattern => pattern.test(room));

    // Additional permission checks based on room type
    if (room.startsWith('user:') && !room.endsWith(`:${user.userId}`)) {
      return false; // Users can only join their own user room
    }

    return isValidPattern;
  }

  private addToRoom(room: string, socketId: string): void {
    if (!this.roomSubscriptions.has(room)) {
      this.roomSubscriptions.set(room, new Set());
    }
    this.roomSubscriptions.get(room)!.add(socketId);

    if (!this.socketRooms.has(socketId)) {
      this.socketRooms.set(socketId, new Set());
    }
    this.socketRooms.get(socketId)!.add(room);
  }

  private removeFromRoom(room: string, socketId: string): void {
    const roomSockets = this.roomSubscriptions.get(room);
    if (roomSockets) {
      roomSockets.delete(socketId);
      if (roomSockets.size === 0) {
        this.roomSubscriptions.delete(room);
      }
    }

    const socketRooms = this.socketRooms.get(socketId);
    if (socketRooms) {
      socketRooms.delete(room);
    }
  }

  // Service communication
  private emitToService(service: string, message: WebSocketMessage, senderSocket?: AuthenticatedSocket): void {
    // This would emit to internal service handlers
    // In a real implementation, this would use event emitters or message queues
    console.log(`🔄 Routing message to ${service}:`, message.type);
  }

  // Metrics and monitoring
  private updateMessageMetrics(): void {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);

    // Find or create entry for current minute
    let minuteEntry = this.messageHistory.find(entry => entry.timestamp === currentMinute);
    if (!minuteEntry) {
      minuteEntry = { timestamp: currentMinute, count: 0 };
      this.messageHistory.push(minuteEntry);
    }

    minuteEntry.count++;

    // Calculate messages per second (last minute)
    this.metrics.lastMinuteMessages = minuteEntry.count;
    this.metrics.messagesPerSecond = minuteEntry.count / 60;
  }

  private cleanupMessageHistory(): void {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);

    // Remove entries older than 5 minutes
    this.messageHistory = this.messageHistory.filter(
      entry => currentMinute - entry.timestamp < 5
    );
  }

  getMetrics(): ConnectionMetrics & { roomCount: number; clientDetails: Array<{ socketId: string; userId: string; rooms: string[] }> } {
    const clientDetails = Array.from(this.connectedClients.entries()).map(([socketId, socket]) => ({
      socketId,
      userId: socket.userId,
      rooms: Array.from(this.socketRooms.get(socketId) || []),
    }));

    return {
      ...this.metrics,
      roomCount: this.roomSubscriptions.size,
      clientDetails,
    };
  }

  // Health check
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const metrics = this.getMetrics();

      return {
        status: 'healthy',
        details: {
          ...metrics,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      };
    }
  }

  // Graceful shutdown
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down WebSocket server...');

    if (this.io) {
      // Notify all connected clients
      this.io.emit('server_shutdown', {
        type: 'server_shutdown',
        data: { message: 'Server is shutting down', reconnectIn: 5000 },
        timestamp: new Date().toISOString(),
      });

      // Close all connections
      this.io.close();
      this.io = null;
    }

    // Clear data structures
    this.connectedClients.clear();
    this.roomSubscriptions.clear();
    this.socketRooms.clear();
    this.messageHistory = [];

    console.log('✅ WebSocket server shut down');
  }
}

// Singleton instance
const wsManager = new WebSocketManager();

export function getWebSocketManager(): WebSocketManager {
  return wsManager;
}

export { WebSocketManager as WebSocket };
