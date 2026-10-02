import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Group } from '../../services/group';
import { User } from '../../services/user';
import { Administration } from '../administration/administration';
import {
  ApiMessage,
  GroupRequestData,
  PendingChannelRequest,
  PendingGroupRequest,
  RequestDecision,
} from '../../models/group.model';

@Component({
  imports: [FormsModule, RouterLink, Administration],
  selector: 'app-dashboard',
  styleUrl: './dashboard.css',
  templateUrl: './dashboard.html',
})
export class Dashboard implements OnInit {
  currentuser: any = null;
  feedbackMessage = signal('');
  feedbackType = signal<'success' | 'error'>('success');
  constructor(private router: Router) {}
  isHome = false;
  profileFirstName = '';
  profileLastName = '';
  profileEmail = '';
  profileDateOfBirth = '';
  currentPassword = '';
  profileImage = '';
  passwordCurrent = '';
  newPassword = '';
  confirmPassword = '';

  ngOnInit() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.currentuser = JSON.parse(storedUser);
      this.isHome = this.router.url.split(/[?#]/)[0] === '/home';
      if (this.isHome && this.currentuser.role === 'superAdmin') {
        this.router.navigate(['/dashboard']);
        return;
      }
      this.profileFirstName = this.currentuser.firstName;
      this.profileLastName = this.currentuser.lastName;
      this.profileEmail = this.currentuser.email;
      this.profileDateOfBirth = this.currentuser.dateOfBirth || '';
      this.profileImage = this.currentuser.profileImage || '';
      this.loadGroups(); 
      this.loadChannels();
      if (!this.isHome) {
        this.loadGroupRequests();
      }
    } else {
      this.router.navigate(['/login']);
    }
  }

  groupTitle: string = '';
  groupDescription: string = '';
  minimumAge: number | null = null;

  adminChannelName: string = '';
  selectedAdminGroupTitle: string = '';
  groupSearch: string = '';

  private groupService = inject(Group);
  private userService = inject(User);

  // Read a small image so the existing profile request can save it to MongoDB.
  selectProfileImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      input.value = '';
      this.showFeedback('Use a PNG, JPEG or GIF image up to 2 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.profileImage = String(reader.result);
    reader.onerror = () => this.showFeedback('Image could not be opened.', 'error');
    reader.readAsDataURL(file);
  }

  saveProfile() {
    this.userService.updateProfile(this.currentuser.username, {
      firstName: this.profileFirstName,
      lastName: this.profileLastName,
      email: this.profileEmail,
      dateOfBirth: this.profileDateOfBirth,
      currentPassword: this.currentPassword,
      profileImage: this.profileImage,
    }).subscribe({
      next: (response) => {
        this.currentuser = response.user;
        localStorage.setItem('currentUser', JSON.stringify(response.user));
        this.currentPassword = '';
        this.showFeedback(response.message, 'success');
      },
      error: (error: HttpErrorResponse) => {
        this.showApiError(error, 'Profile could not be saved.');
      },
    });
  }

  changePassword() {
    if (this.newPassword !== this.confirmPassword) {
      this.showFeedback('New passwords do not match.', 'error');
      return;
    }
    this.userService.changePassword(this.currentuser.username, {
      currentPassword: this.passwordCurrent,
      newPassword: this.newPassword,
      confirmPassword: this.confirmPassword,
    }).subscribe({
      next: response => {
        this.passwordCurrent = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.currentPassword = '';
        this.showFeedback(response.message, 'success');
      },
      error: (error: HttpErrorResponse) => this.showApiError(error, 'Password could not be changed.'),
    });
  }

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
        this.loadGroupRequests();
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
        if (!this.isHome && this.isGroupAdminOfAnyGroup()) {
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
    return this.channels().filter(channel => channel.groupTitle === groupTitle);
  }

  getJoinedGroups() {
    return this.groups().filter(group =>
      group.members.includes(this.currentuser.username)
    );
  }

  getAdminGroups() {
    return this.groups().filter(group => this.isGroupAdmin(group));
  }

  getMemberGroups() {
    return this.getJoinedGroups().filter(group => !this.isGroupAdmin(group));
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

  openChannel(groupTitle: string, channelName: string) {
    this.router.navigate(['/chat', groupTitle, channelName]);
  }

  isGroupAdmin(group: any) {
    return group.admins.includes(this.currentuser.username);
  }

  isGroupAdminOfAnyGroup() {
    return this.getAdminGroups().length > 0;
  }

  logout() {
    this.userService.logout().subscribe({
      next: () => {
        localStorage.removeItem('currentUser');
        this.router.navigate(['/']);
      },
      error: () => {
        localStorage.removeItem('currentUser');
        this.router.navigate(['/']);
      },
    });
  }

  private showApiError(error: HttpErrorResponse, fallbackMessage: string) {
    if (error.status === 401) {
      localStorage.removeItem('currentUser');
      this.router.navigate(['/login']);
      return;
    }
    this.showFeedback(error.error?.message ?? fallbackMessage, 'error');
  }

  private showFeedback(message: string, type: 'success' | 'error') {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
