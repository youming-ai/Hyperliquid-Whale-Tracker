import { WebSocket, WebSocketServer } from 'ws';

export class WebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, ws);

      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleMessage(clientId, data);
        } catch (error) {
          console.error('Invalid message format:', error);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(`WebSocket client disconnected: ${clientId}`);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send welcome message
      ws.send(
        JSON.stringify({
          type: 'welcome',
          clientId,
          timestamp: new Date().toISOString(),
        }),
      );
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private handleMessage(clientId: string, data: any) {
    switch (data.type) {
      case 'subscribe':
        this.handleSubscription(clientId, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(clientId, data);
        break;
      default:
        console.log(`Unknown message type: ${data.type}`);
    }
  }

  private handleSubscription(clientId: string, data: any) {
    console.log(`Client ${clientId} subscribed to: ${data.channel}`);
    // TODO: Implement subscription logic
  }

  private handleUnsubscription(clientId: string, data: any) {
    console.log(`Client ${clientId} unsubscribed from: ${data.channel}`);
    // TODO: Implement unsubscription logic
  }

  broadcast(data: any) {
    const message = JSON.stringify(data);
    this.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  sendToClient(clientId: string, data: any) {
    const ws = this.clients.get(clientId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}
