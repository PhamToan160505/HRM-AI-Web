import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

let stompClient;

export function connectSocket(token, onNotification) {
  if (stompClient?.active) return;

  stompClient = new Client({
    webSocketFactory: () => new SockJS(import.meta.env.VITE_WS_URL || '/ws'),
    connectHeaders: { Authorization: `Bearer ${token}` },
    debug: (str) => {
      // console.log(str); // Uncomment for debug
    },
    onConnect: () => {
      console.log('Connected to WebSocket STOMP');
      // Spring uses /user/queue/notifications for user-specific destinations when 
      // convertAndSendToUser is called with destination "/queue/notifications"
      stompClient.subscribe(`/user/queue/notifications`, (message) => {
        onNotification(JSON.parse(message.body));
      });
    },
    onStompError: (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    },
  });

  stompClient.activate();
  return stompClient;
}

export function disconnectSocket() {
  if (stompClient) {
    stompClient.deactivate();
  }
}
