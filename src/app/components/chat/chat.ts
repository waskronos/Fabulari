import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatMessage } from '../../models/chat.model';
import { SocketService } from '../../services/socket';

@Component({
  selector: 'app-chat',
  imports: [FormsModule, DatePipe],
  templateUrl: './chat.html',
  styleUrl: './chat.css',
})
export class Chat implements OnInit, OnDestroy {
  groupTitle = '';
  channelName = '';
  messageText = '';
  messageImage = signal('');
  readingImage = signal(false);
  sendingMessage = signal(false);
  private imageInput?: HTMLInputElement;
  currentUser: any = null;
  messages = signal<ChatMessage[]>([]);
  channelJoined = signal(false);
  errorMessage = signal('');

  private socketService = inject(SocketService);
  notification = signal('');
  private notificationTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit() {
    const storedUser = localStorage.getItem('currentUser');

    if (!storedUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.currentUser = JSON.parse(storedUser);
    this.groupTitle = this.route.snapshot.paramMap.get('groupTitle') ?? '';
    this.channelName = this.route.snapshot.paramMap.get('channelName') ?? '';

    if (!this.groupTitle || !this.channelName) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.socketService.initSocket();
    this.socketService.onMessage(message => {
      this.messages.update(messages => [...messages, message]);
      this.errorMessage.set('');
    });
    this.socketService.onHistory(messages => this.messages.set(messages));
    this.socketService.onJoined(() => {
      this.channelJoined.set(true);
      this.errorMessage.set('');
    });
    this.socketService.onLeft(() => {
      this.sendingMessage.set(false);
      this.channelJoined.set(false);
      this.errorMessage.set('Channel closed. Return to your dashboard to open it again.');
    });
    this.socketService.onError(message => {
      this.sendingMessage.set(false);
      this.errorMessage.set(message);
    });
    this.socketService.onDeleted(id => {
      this.messages.update(messages => messages.filter(message => message._id !== id));
    });
    this.socketService.onNotification(message => {
      this.notification.set(message);
      clearTimeout(this.notificationTimer);
      this.notificationTimer = setTimeout(() => this.notification.set(''), 5000);
    });
    this.socketService.onConnected(() => {
      this.socketService.joinChannel({
        groupTitle: this.groupTitle, channelName: this.channelName,
      });
    });
    this.socketService.connect();
  }

  deleteMessage(message: ChatMessage) {
    if (message.username === this.currentUser.username && confirm('Delete this message?')) {
      this.socketService.deleteMessage(message._id);
    }
  }

  // Preview the image before sending it through the existing socket message.
  selectImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.imageInput = input;
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      this.removeImage();
      this.errorMessage.set('Use a PNG, JPEG or GIF image up to 2 MB.');
      return;
    }
    this.readingImage.set(true);
    this.errorMessage.set('');
    const reader = new FileReader();
    reader.onload = () => {
      this.messageImage.set(String(reader.result));
      this.readingImage.set(false);
    };
    reader.onerror = () => {
      this.removeImage();
      this.readingImage.set(false);
      this.errorMessage.set('Image could not be opened.');
    };
    reader.readAsDataURL(file);
  }

  removeImage() {
    this.messageImage.set('');
    if (this.imageInput) this.imageInput.value = '';
  }

  sendMessage() {
    if (this.sendingMessage() || this.readingImage() || !this.channelJoined()) return;
    if (!this.messageText.trim() && !this.messageImage()) {
      this.errorMessage.set('Add text or an image.');
      return;
    }

    this.sendingMessage.set(true);
    this.socketService.sendMessage({text: this.messageText, image: this.messageImage()}, success => {
      this.sendingMessage.set(false);
      if (success) {
        this.messageText = '';
        this.removeImage();
      }
    });
  }

  backToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  ngOnDestroy() {
    clearTimeout(this.notificationTimer);
    this.socketService.disconnect();
  }
}
