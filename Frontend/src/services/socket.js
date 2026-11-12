import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient = null;
let currentToken = null;
let messageHandlers = {
  onNotification: null,
  onTechSync: null,
};

export function connectSocket(token, onNotification, onTechSync) {
  messageHandlers = { onNotification, onTechSync };

  if (stompClient?.active && currentToken === token) {
    return stompClient;
  }

  if (stompClient) {
    const oldClient = stompClient;
    stompClient = null;
    oldClient.deactivate();
  }

  currentToken = token;

  const client = new Client({
    webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL || '/ws'),
    connectHeaders: { Authorization: `Bearer ${token}` },
    debug: () => {
      // console.log(str); // Uncomment for debug
    },
    onConnect: () => {
      if (stompClient !== client) return;
      console.log('Connected to WebSocket STOMP');
      // Spring uses /user/queue/notifications for user-specific destinations when
      // convertAndSendToUser is called with destination "/queue/notifications"
      client.subscribe(`/user/queue/notifications`, (message) => {
        try {
          messageHandlers.onNotification?.(JSON.parse(message.body));
        } catch (err) {
          console.error('Error parsing notification payload:', err);
        }
      });

      client.subscribe(`/topic/tech-updates`, (message) => {
        try {
          messageHandlers.onTechSync?.(JSON.parse(message.body));
        } catch (err) {
          console.error('Error parsing tech sync payload:', err);
        }
      });
    },
    onStompError: (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    },
  });

  stompClient = client;
  client.activate();
  return client;
}

export function disconnectSocket() {
  const client = stompClient;
  stompClient = null;
  currentToken = null;
  messageHandlers = { onNotification: null, onTechSync: null };
  if (client) {
    client.deactivate();
  }
}
