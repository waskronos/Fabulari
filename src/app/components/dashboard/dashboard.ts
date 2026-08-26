import { Component, OnInit, inject } from '@angular/core';
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
    } else {
      this.router.navigate(['/login']);
    }
  }

  groupTitle: string = '';
  groupDescription: string = '';
  minimumAge: number | null = null;
  groupAdmin: string = '';

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
      },
      error: (error) => {
        console.error('Error creating group:', error);
      }
    });
  }

  groups: any[] = [];
  loadGroups(){
    this.groupService.getGroup().subscribe({
      next: (response) => {
        this.groups = response;
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
      },
      error: (error) => {
        console.error('Error approving join request:', error);
      }
    });
  }
}
