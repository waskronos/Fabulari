import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ChatMessage } from '../../models/chat.model';
import { SocketService } from '../../services/socket';
import { Group } from '../../services/group';
import { Subscription } from 'rxjs';

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
  group = signal<any>(null);
  channels = signal<any[]>([]);
  newChannelName = '';
  channelFormOpen = false;
  channelFeedback = signal('');
  private groupService = inject(Group);
  private routeSubscription?: Subscription;

  private socketService = inject(SocketService);
  notification = signal('');
  theme = signal('default');
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
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.groupTitle = params.get('groupTitle') || '';
      this.channelName = params.get('channelName') || '';
      this.channelFormOpen = false;
      this.channelFeedback.set('');
      this.newChannelName = '';
      this.loadGroup();
      this.openRoom();
    });
  }

  loadGroup() {
    const groupTitle = this.groupTitle;
    this.group.set(null);
    this.channels.set([]);
    this.groupService.getGroup().subscribe({
      next: groups => {
        if (groupTitle !== this.groupTitle) return;
        const group = groups.find(group => group.title === this.groupTitle);
        if (!group || !group.members.includes(this.currentUser.username) ||
            this.currentUser.age < group.minimumAge || (group.bannedMembers || []).includes(this.currentUser.username)) {
          this.errorMessage.set('You do not have access to this group.');
          return;
        }
        this.group.set(group);
        if (!this.channelName) this.theme.set(group.theme || 'default');
      },
      error: error => this.errorMessage.set(error.error?.message || 'Group could not be loaded.'),
    });
    this.groupService.getChannels().subscribe({
      next: channels => {
        if (groupTitle === this.groupTitle) this.channels.set(channels.filter(channel => channel.groupTitle === groupTitle));
      },
      error: error => this.errorMessage.set(error.error?.message || 'Channels could not be loaded.'),
    });
  }

  isGroupAdmin() {
    return this.group()?.admins.includes(this.currentUser.username) || false;
  }

  saveChannel() {
    const request = this.isGroupAdmin()
      ? this.groupService.createChannel(this.newChannelName, this.groupTitle, this.currentUser.username)
      : this.groupService.requestChannel({name: this.newChannelName, groupTitle: this.groupTitle, requestedBy: this.currentUser.username});
    request.subscribe({
      next: response => {
        this.channelFeedback.set(response.message);
        this.newChannelName = '';
        this.loadGroup();
      },
      error: error => this.channelFeedback.set(error.error?.message || 'Channel could not be saved.'),
    });
  }

  openChannel(name: string) {
    this.router.navigate(['/chat', this.groupTitle, name]);
  }

  openRoom() {
    this.socketService.disconnect();
    clearTimeout(this.notificationTimer);
    this.notification.set('');
    this.messages.set([]);
    this.channelJoined.set(false);
    this.errorMessage.set('');
    this.messageText = '';
    this.removeImage();
    this.sendingMessage.set(false);
    this.readingImage.set(false);
    if (!this.channelName) return;

    this.socketService.initSocket();
    this.socketService.onMessage(message => {
      this.messages.update(messages => [...messages, message]);
      this.errorMessage.set('');
    });
    this.socketService.onHistory(messages => this.messages.set(messages));
    this.socketService.onJoined(channel => {
      this.theme.set(channel.theme);
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
    this.socketService.onUserDeleted(username => {
      this.messages.update(messages => messages.filter(message => message.username !== username));
    });
    this.socketService.onThemeChanged(theme => this.theme.set(theme));
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

  getThemeColor() {
    return this.theme() === 'navy' ? '#101b2c' : this.theme() === 'plum' ? '#24172c' : '#24172f';
  }

  deleteMessage(message: ChatMessage) {
    if (message.username === this.currentUser.username && confirm('Delete this message?')) {
      this.socketService.deleteMessage(message._id);
    }
  }

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
    const channelName = this.channelName;
    const reader = new FileReader();
    reader.onload = () => {
      if (channelName !== this.channelName) return;
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
    const channelName = this.channelName;
    this.socketService.sendMessage({text: this.messageText, image: this.messageImage()}, success => {
      if (channelName !== this.channelName) return;
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
    this.routeSubscription?.unsubscribe();
    clearTimeout(this.notificationTimer);
    this.socketService.disconnect();
  }
}
