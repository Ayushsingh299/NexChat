import { Client, type IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

class WebSocketService {
  private client: Client;
  private onMessageCallback: ((msg: any) => void) | null = null;
  private onPresenceCallback: ((msg: any) => void) | null = null;
  private onTypingCallback: ((msg: any) => void) | null = null;
  private onConnectCallback: (() => void) | null = null;
  private onWebRTCCallback: ((signal: any) => void) | null = null;
  private onReconnectCallback: (() => void) | null = null;
  private onDisconnectCallback: (() => void) | null = null;
  private groupSubscriptions: Map<number, any> = new Map();
  private pendingGroupSubscriptions: Set<number> = new Set();
  private offlineQueue: Array<{ destination: string, body: string }> = [];
  private hasConnectedBefore: boolean = false;

  constructor() {
    this.client = new Client({
      webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL || 'http://localhost:8080/ws'),
      debug: function (str) {
        console.log(str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    this.client.onConnect = (frame) => {
      console.log('Connected: ' + frame);
      
      this.pendingGroupSubscriptions.forEach(groupId => {
        if (!this.groupSubscriptions.has(groupId)) {
          const sub = this.client.subscribe(`/topic/group.${groupId}`, (message: IMessage) => {
            if (this.onMessageCallback) {
              this.onMessageCallback(JSON.parse(message.body));
            }
          });
          
          this.client.subscribe(`/topic/group.${groupId}.typing`, (message: IMessage) => {
            if (this.onTypingCallback) {
              this.onTypingCallback(JSON.parse(message.body));
            }
          });
          
          this.groupSubscriptions.set(groupId, sub);
        }
      });
      this.pendingGroupSubscriptions.clear();

      if (this.hasConnectedBefore) {
        if (this.onReconnectCallback) {
          this.onReconnectCallback();
        }
        // Flush offline queue
        while (this.offlineQueue.length > 0) {
          const msg = this.offlineQueue.shift();
          if (msg) {
            this.client.publish(msg);
          }
        }
      } else {
        this.hasConnectedBefore = true;
        if (this.onConnectCallback) {
          this.onConnectCallback();
        }
      }

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user.id) {
        this.client.subscribe(`/user/${user.id}/queue/messages`, (message: IMessage) => {
          if (this.onMessageCallback) {
            this.onMessageCallback(JSON.parse(message.body));
          }
        });

        this.client.subscribe('/topic/presence', (message: IMessage) => {
          if (this.onPresenceCallback) {
            this.onPresenceCallback(JSON.parse(message.body));
          }
        });
        
        this.client.subscribe(`/user/${user.id}/queue/typing`, (message: IMessage) => {
          if (this.onTypingCallback) {
            this.onTypingCallback(JSON.parse(message.body));
          }
        });

        this.client.subscribe(`/user/${user.id}/queue/webrtc`, (message: IMessage) => {
          if (this.onWebRTCCallback) {
            this.onWebRTCCallback(JSON.parse(message.body));
          }
        });
        
        // Start heartbeat
        setInterval(() => this.sendHeartbeat(), 30000);
      }
    };

    this.client.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    this.client.onWebSocketClose = () => {
      console.warn("WebSocket connection lost.");
      if (this.onDisconnectCallback) {
        this.onDisconnectCallback();
      }
    };
  }

  public connect() {
    const token = localStorage.getItem('token');
    if (token) {
      this.client.connectHeaders = {
        Authorization: `Bearer ${token}`
      };
      this.client.activate();
    }
  }

  public disconnect() {
    if (this.client.active) {
      this.client.deactivate();
    }
  }

  public setOnMessage(callback: (msg: any) => void) {
    this.onMessageCallback = callback;
  }

  public setOnPresence(callback: (msg: any) => void) {
    this.onPresenceCallback = callback;
  }

  public setOnTyping(callback: (msg: any) => void) {
    this.onTypingCallback = callback;
  }

  public setOnConnect(callback: () => void) {
    this.onConnectCallback = callback;
  }

  public setOnWebRTC(callback: (signal: any) => void) {
    this.onWebRTCCallback = callback;
  }

  public setOnReconnect(callback: () => void) {
    this.onReconnectCallback = callback;
  }

  public setOnDisconnect(callback: () => void) {
    this.onDisconnectCallback = callback;
  }

  public subscribeToGroup(groupId: number) {
    if (!this.client.connected) {
      this.pendingGroupSubscriptions.add(groupId);
      return;
    }
    
    if (!this.groupSubscriptions.has(groupId)) {
      const sub = this.client.subscribe(`/topic/group.${groupId}`, (message: IMessage) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(JSON.parse(message.body));
        }
      });
      
      this.client.subscribe(`/topic/group.${groupId}.typing`, (message: IMessage) => {
        if (this.onTypingCallback) {
          this.onTypingCallback(JSON.parse(message.body));
        }
      });
      
      this.groupSubscriptions.set(groupId, sub);
    }
  }

  public sendMessage(recipientId: number, content: string, isGroup: boolean = false, attachmentUrl?: string, replyToMessageId?: number, expiresInSeconds?: number) {
    const clientMessageId = crypto.randomUUID();
    let msgPayload;
    if (isGroup) {
      msgPayload = {
        destination: '/app/chat.sendGroupMessage',
        body: JSON.stringify({ groupId: recipientId, content, attachmentUrl, replyToMessageId, expiresInSeconds, clientMessageId })
      };
    } else {
      msgPayload = {
        destination: '/app/chat.sendMessage',
        body: JSON.stringify({ recipientId, content, attachmentUrl, replyToMessageId, expiresInSeconds, clientMessageId })
      };
    }
    
    if (this.client.connected) {
      this.client.publish(msgPayload);
    } else {
      console.warn("STOMP Client offline. Queuing message...");
      this.offlineQueue.push(msgPayload);
    }
  }
  
  public sendHeartbeat() {
    if (this.client.connected) {
      this.client.publish({ destination: '/app/heartbeat', body: '' });
    }
  }

  public sendTyping(recipientId: number, isGroup: boolean = false) {
    if (this.client.connected) {
      this.client.publish({ 
        destination: '/app/chat.typing', 
        body: JSON.stringify({ recipientId, isGroup }) 
      });
    }
  }

  public sendWebRTCSignal(signal: any) {
    if (this.client.connected) {
      this.client.publish({
        destination: '/app/webrtc.signal',
        body: JSON.stringify(signal)
      });
    }
  }
}

export const wsService = new WebSocketService();
