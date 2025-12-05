import { SignalMessage } from '../types';

// NOTE: In a production app, this would be a WebSocket connection or Firebase listener.
// We use BroadcastChannel to allow two tabs in the same browser to communicate 
// without a backend server, fulfilling the "Serverless" requirements for this demo.

class SignalingService {
  private channel: BroadcastChannel | null = null;
  private onMessageCallback: ((msg: SignalMessage) => void) | null = null;
  private peerId: string = '';
  private userName: string = 'Anonymous';

  // Changed userId to peerId to emphasize it's a session ID
  connect(roomId: string, peerId: string, userName: string, onMessage: (msg: SignalMessage) => void) {
    this.peerId = peerId;
    this.userName = userName;
    this.onMessageCallback = onMessage;
    
    // Create a unique channel for this room
    this.channel = new BroadcastChannel(`streamconnect_room_${roomId}`);
    
    this.channel.onmessage = (event) => {
      const msg = event.data as SignalMessage;
      // Filter out messages from self (BroadcastChannel sends to all subscribers)
      if (msg.senderId !== this.peerId) {
        if (this.onMessageCallback) {
          this.onMessageCallback(msg);
        }
      }
    };

    console.log(`Connected to signaling channel for room: ${roomId}`);
    
    // Announce join
    this.send({ type: 'join' });
  }

  send(msg: Omit<SignalMessage, 'senderId' | 'senderName'>) {
    if (this.channel) {
      // senderId and senderName are automatically added here
      const fullMsg: SignalMessage = { 
        ...msg, 
        senderId: this.peerId,
        senderName: this.userName 
      };
      this.channel.postMessage(fullMsg);
    }
  }

  disconnect() {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

export const signaling = new SignalingService();