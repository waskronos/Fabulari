import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
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
  currentUser: any = null;
  messages: ChatMessage[] = [];
  channelJoined = signal(false);
  errorMessage = signal('');

  private socketService = inject(SocketService);
  private subscriptions: Subscription[] = [];

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
    this.subscriptions.push(
      this.socketService.getMessages().subscribe(message => {
        this.messages.push(message);
        this.errorMessage.set('');
      }),
      this.socketService.getJoined().subscribe(() => {
        this.channelJoined.set(true);
        this.errorMessage.set('');
      }),
      this.socketService.getErrors().subscribe(message => {
        this.channelJoined.set(false);
        this.errorMessage.set(message);
      })
    );
    this.socketService.joinChannel({
      groupTitle: this.groupTitle,
      channelName: this.channelName,
      username: this.currentUser.username,
    });
  }

  sendMessage() {
    if (!this.messageText.trim()) {
      this.errorMessage.set('Message cannot be empty');
      return;
    }

    this.socketService.sendMessage(this.messageText);
    this.messageText = '';
  }

  backToDashboard() {
    this.router.navigate(['/dashboard']);
  }

  ngOnDestroy() {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }

    this.socketService.disconnect();
  }
}
