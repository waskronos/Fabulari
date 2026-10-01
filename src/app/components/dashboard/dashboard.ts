import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import {FormsModule} from '@angular/forms';
import { Group } from '../../services/group';
import {
  ApiMessage,
  ChannelRequestData,
  GroupRequestData,
  PendingChannelRequest,
  PendingGroupRequest,
  RequestDecision,
} from '../../models/group.model';

@Component({
  imports: [FormsModule],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  currentuser: any = null;
  feedbackMessage = signal('');
  feedbackType = signal<'success' | 'error'>('success');
  constructor(private router: Router) {}

  ngOnInit() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentuser = JSON.parse(storedUser);
      this.loadGroups(); 
      this.loadChannels();
      if (this.currentuser.role === 'superAdmin') {
        this.loadGroupRequests();
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  groupTitle: string = '';
  groupDescription: string = '';
  minimumAge: number | null = null;

  channelName: string = '';
  selectedGroupTitle: string = '';
  adminChannelName: string = '';
  selectedAdminGroupTitle: string = '';
  groupSearch: string = '';

  private groupService = inject(Group);

  requestGroup() {
    const request: GroupRequestData = {
      title: this.groupTitle,
      description: this.groupDescription,
      minimumAge: this.minimumAge,
      requestedBy: this.currentuser.username,
    };

    this.groupService.requestGroup(request).subscribe({
      next: (response: ApiMessage) => {
        this.showFeedback(response.message, 'success');
        this.groupTitle = '';
        this.groupDescription = '';
        this.minimumAge = null;
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Group request could not be sent.');
      }
    });
  }

  groupRequests = signal<PendingGroupRequest[]>([]);

  loadGroupRequests() {
    this.groupService.getGroupRequests(this.currentuser.username).subscribe({
      next: (requests) => this.groupRequests.set(requests),
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Group requests could not be loaded.');
      },
    });
  }

  reviewGroupRequest(requestId: string, action: RequestDecision) {
    this.groupService
      .reviewGroupRequest(requestId, action, this.currentuser.username)
      .subscribe({
        next: (response: ApiMessage) => {
          this.showFeedback(response.message, 'success');
          this.loadGroupRequests();
          this.loadGroups();
        },
        error: (error: HttpErrorResponse) => {
          this.showApiError(error, 'Group request could not be reviewed.');
        },
      });
  }

  groups= signal<any[]>([]);
  loadGroups(){
    this.groupService.getGroup().subscribe({
      next: (response) => {
        this.groups.set(response);
        if (this.isGroupAdminOfAnyGroup()) {
          this.loadChannelRequests();
        }
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
  channelRequests = signal<PendingChannelRequest[]>([]);

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

  requestChannel() {
    const request: ChannelRequestData = {
      name: this.channelName,
      groupTitle: this.selectedGroupTitle,
      requestedBy: this.currentuser.username
    };

    this.groupService.requestChannel(request).subscribe({
      next: (response: ApiMessage) => {
        this.showFeedback(response.message, 'success');

        this.channelName = '';
        this.selectedGroupTitle = '';
        if (this.isGroupAdminOfAnyGroup()) {
          this.loadChannelRequests();
        }
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Channel request could not be sent.');
      }
    });
  }

  createChannel() {
    this.groupService.createChannel(
      this.adminChannelName,
      this.selectedAdminGroupTitle,
      this.currentuser.username
    ).subscribe({
      next: (response: ApiMessage) => {
        this.adminChannelName = '';
        this.selectedAdminGroupTitle = '';
        this.showFeedback(response.message, 'success');
        this.loadChannels();
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Channel could not be created.');
      }
    });
  }

  loadChannelRequests() {
    this.groupService.getChannelRequests(this.currentuser.username).subscribe({
      next: (requests) => {
        this.channelRequests.set(requests);
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Channel requests could not be loaded.');
      }
    });
  }

  reviewChannelRequest(requestId: string, action: RequestDecision) {
    this.groupService
      .reviewChannelRequest(requestId, action, this.currentuser.username)
      .subscribe({
        next: (response: ApiMessage) => {
          this.showFeedback(response.message, 'success');
          this.loadChannelRequests();
          this.loadChannels();
        },
        error: (error: HttpErrorResponse) => {
          this.showApiError(error, 'Channel request could not be reviewed.');
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

  getJoinedGroups() {
    return this.groups().filter(group =>
      group.members.includes(this.currentuser.username)
    );
  }

  openGeneralChat() {
    const generalGroup = this.groups().find(group => group.title === 'Fabulari');

    if (!generalGroup?.members.includes(this.currentuser.username)) {
      this.showFeedback('Please log out and sign in again to refresh your account.', 'error');
      return;
    }

    this.openChannel('Fabulari', 'general');
  }

  getFilteredGroups() {
    const search = this.groupSearch.trim().toLowerCase();

    return this.groups().filter(group =>
      group.title.toLowerCase().includes(search) ||
      group.description.toLowerCase().includes(search)
    );
  }

  getInitials() {
    return `${this.currentuser.firstName[0]}${this.currentuser.lastName[0]}`.toUpperCase();
  }

  getRoleName() {
    return this.currentuser.role === 'superAdmin' ? 'Super Admin' : 'Member';
  }

  openChannel(groupTitle: string, channelName: string) {
    this.router.navigate(['/chat', groupTitle, channelName]);
  }

  isGroupAdmin(group: any) {
    return group.admins.includes(this.currentuser.username);
  }

  isGroupAdminOfAnyGroup() {
    const allGroups = this.groups();

    for (let i = 0; i < allGroups.length; i++) {
      if (this.isGroupAdmin(allGroups[i])) {
        return true;
      }
    }

    return false;
  }

  isMemberOnly(group: any) {
    return group.members.includes(this.currentuser.username) && !this.isGroupAdmin(group);
  }

  isMemberOnlyOfAnyGroup() {
    const allGroups = this.groups();

    for (let i = 0; i < allGroups.length; i++) {
      if (this.isMemberOnly(allGroups[i])) {
        return true;
      }
    }

    return false;
  }

  logout() {
    localStorage.removeItem('currentUser');
    this.router.navigate(['/']);
  }

  private showApiError(error: HttpErrorResponse, fallbackMessage: string) {
    this.showFeedback(error.error?.message ?? fallbackMessage, 'error');
  }

  private showFeedback(message: string, type: 'success' | 'error') {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
