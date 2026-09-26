import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {FormsModule} from '@angular/forms';
import { Group } from '../../services/group';

@Component({
  imports: [FormsModule],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  currentuser: any = null;
  feedbackMessage: string = '';
  feedbackType: 'success' | 'error' = 'success';
  constructor(private router: Router) {}

  ngOnInit() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentuser = JSON.parse(storedUser);
      this.loadGroups(); 
      this.loadChannels();
    } else {
      this.router.navigate(['/login']);
    }
  }

  groupTitle: string = '';
  groupDescription: string = '';
  minimumAge: number | null = null;
  groupAdmin: string = '';

  channelName: string = '';
  channelMinimumAge: number | null = null;
  selectedGroupTitle: string = '';

  private groupService = inject(Group);

  createGroup() {
    const group = {
      title: this.groupTitle,
      description: this.groupDescription,
      minimumAge: this.minimumAge,
      admin: this.groupAdmin
    };

    this.groupService.createGroup(group).subscribe({
      next: (response: any) => {
        this.showFeedback(response.message, 'success');
        this.loadGroups();
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Group could not be created.');
      }
    });
  }

  groups= signal<any[]>([]);
  loadGroups(){
    this.groupService.getGroup().subscribe({
      next: (response) => {
        this.groups.set(response);
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Groups could not be loaded.');
      }
    });
  }
  
  requestJoin(group: any) {
    this.groupService.requestJoin(group.title, this.currentuser.username).subscribe({
      next: (response: any) => {
        this.showFeedback(response.message, 'success');
        this.loadGroups();
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Join request could not be sent.');
      }
    });
  }

  approveJoin(group: any, username: string) {
    this.groupService.approveJoin(group.title, username).subscribe({
      next: (response: any) => {
        this.showFeedback(response.message, 'success');
        this.loadGroups();
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Join request could not be approved.');
      }
    });
  }

  channels = signal<any[]>([]);

  loadChannels(){
    this.groupService.getChannels().subscribe({
      next: (response) => {
        this.channels.set(response);
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Channels could not be loaded.');
      }
    });
  }

  createChannel() {
    const channel = {
      name: this.channelName,
      groupTitle: this.selectedGroupTitle,
      minimumAge: this.channelMinimumAge,
      createdBy: this.currentuser.username
    };

  this.groupService.createChannel(channel).subscribe({
    next: (response: any) => {
      this.showFeedback(response.message, 'success');

      this.channelName = '';
      this.channelMinimumAge = null;
      this.selectedGroupTitle = '';

      this.loadChannels();
    },
    error: (error: HttpErrorResponse) => {
      this.showApiError(error, 'Channel could not be created.');
    }
  });
}

  getChannelsForGroup(groupTitle: string) {
    const groupChannels = [];
    const allChannels = this.channels();

    for(let i = 0; i < allChannels.length; i++){
      if(allChannels[i].groupTitle === groupTitle){
        groupChannels.push(allChannels[i]);
      }
    }

    return groupChannels;

    
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/']);
  }

  private showApiError(error: HttpErrorResponse, fallbackMessage: string) {
    this.showFeedback(error.error?.message ?? fallbackMessage, 'error');
  }

  private showFeedback(message: string, type: 'success' | 'error') {
    this.feedbackMessage = message;
    this.feedbackType = type;
  }
}
