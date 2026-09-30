import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { ChatMessage, JoinChannelData } from '../models/chat.model';

const SERVER_URL = 'http://localhost:3000';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket?: Socket;

  initSocket() {
    if (!this.socket) {
      this.socket = io(SERVER_URL);
    }
  }

  joinChannel(channel: JoinChannelData) {
    this.socket?.emit('join-channel', channel);
  }

  sendMessage(message: string) {
    this.socket?.emit('send-message', message);
  }

  getMessages() {
    return new Observable<ChatMessage>(observer => {
      const messageHandler = (message: ChatMessage) => observer.next(message);
      this.socket?.on('new-message', messageHandler);

      return () => this.socket?.off('new-message', messageHandler);
    });
  }

  getHistory() {
    return new Observable<ChatMessage[]>(observer => {
      const historyHandler = (messages: ChatMessage[]) => observer.next(messages);
      this.socket?.on('chat-history', historyHandler);

      return () => this.socket?.off('chat-history', historyHandler);
    });
  }

  getJoined() {
    return new Observable<void>(observer => {
      const joinedHandler = () => observer.next();
      this.socket?.on('channel-joined', joinedHandler);

      return () => this.socket?.off('channel-joined', joinedHandler);
    });
  }

  getErrors() {
    return new Observable<string>(observer => {
      const errorHandler = (message: string) => observer.next(message);
      this.socket?.on('chat-error', errorHandler);

      return () => this.socket?.off('chat-error', errorHandler);
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
