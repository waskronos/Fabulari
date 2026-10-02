import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { ChatMessage, JoinChannelData, MessageInput } from '../models/chat.model';

const SERVER_URL = 'http://localhost:3000';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket?: Socket;

  initSocket() {
    if (!this.socket) {
      const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
      this.socket = io(SERVER_URL, {auth: {token: user?.sessionToken}, autoConnect: false});
    }
  }

  joinChannel(channel: JoinChannelData) {
    this.socket?.emit('join-channel', channel);
  }

  sendMessage(message: MessageInput, callback: (success: boolean) => void) {
    this.socket?.emit('send-message', message, callback);
  }

  connect() {
    this.socket?.connect();
  }

  onMessage(callback: (message: ChatMessage) => void) {
    this.socket?.on('new-message', callback);
  }

  onHistory(callback: (messages: ChatMessage[]) => void) {
    this.socket?.on('chat-history', callback);
  }

  onConnected(callback: () => void) {
    this.socket?.on('connect', callback);
  }

  onJoined(callback: (channel: {theme: string}) => void) {
    this.socket?.on('channel-joined', callback);
  }

  onLeft(callback: () => void) {
    this.socket?.on('channel-left', callback);
    this.socket?.on('disconnect', callback);
  }

  onError(callback: (message: string) => void) {
    this.socket?.on('chat-error', callback);
    this.socket?.on('connect_error', (error: Error) => callback(error.message));
  }

  onNotification(callback: (message: string) => void) {
    this.socket?.on('room-notification', callback);
  }

  deleteMessage(id: string) {
    this.socket?.emit('delete-message', id);
  }

  onDeleted(callback: (id: string) => void) {
    this.socket?.on('message-deleted', callback);
  }

  onUserDeleted(callback: (username: string) => void) {
    this.socket?.on('user-deleted', callback);
  }

  onThemeChanged(callback: (theme: string) => void) {
    this.socket?.on('theme-updated', callback);
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
  }
}
