import { Component, OnInit, inject, signal } from '@angular/core';
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
      next: (response) => {
        console.log('Group created successfully:', response);
        this.loadGroups();
      },
      error: (error) => {
        console.error('Error creating group:', error);
      }
    });
  }

  groups= signal<any[]>([]);
  loadGroups(){
    this.groupService.getGroup().subscribe({
      next: (response) => {
        this.groups.set(response);
        console.log('Groups loaded successfully:', response);
      },
      error: (error) => {
        console.error('Error loading groups:', error);
      }
    });
  }
  
  requestJoin(group: any) {
    this.groupService.requestJoin(group.title, this.currentuser.username).subscribe({
      next: (response) => {
        console.log('Join request sent successfully:', response);
        this.loadGroups();
      },
      error: (error) => {
        console.error('Error sending join request:', error);
      }
    });
  }

  approveJoin(group: any, username: string) {
    this.groupService.approveJoin(group.title, username).subscribe({
      next: (response) => {
        console.log('Join request approved successfully:', response);
        this.loadGroups();
      },
      error: (error) => {
        console.error('Error approving join request:', error);
      }
    });
  }

  channels = signal<any[]>([]);

  loadChannels(){
    this.groupService.getChannels().subscribe({
      next: (response) => {
        this.channels.set(response);
        console.log('Rooms loaded successfully:', response);
      },
      error: (error) => {
        console.error('Error loading rooms:', error);
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
    next: (response) => {
      console.log('Room created successfully:', response);

      this.channelName = '';
      this.channelMinimumAge = null;
      this.selectedGroupTitle = '';

      this.loadChannels();
    },
    error: (error) => {
      console.error('Error creating room:', error);
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
}
