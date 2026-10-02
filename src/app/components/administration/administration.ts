import { Component, EventEmitter, Input, OnChanges, Output, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { Admin } from '../../services/admin';
import { ApiMessage } from '../../models/user.model';

@Component({
  selector: 'app-administration',
  imports: [FormsModule, DatePipe],
  templateUrl: './administration.html',
  styleUrl: './administration.css',
})
export class Administration implements OnChanges {
  @Input() currentUser: any = null;
  @Input() groups: any[] = [];
  @Input() channels: any[] = [];
  @Output() changed = new EventEmitter<void>();

  private adminService = inject(Admin);
  private router = inject(Router);
  feedback = signal('');
  users = signal<any[]>([]);
  requests = signal<any[]>([]);
  logs = signal<any[]>([]);
  groupId = '';
  description = '';
  minimumAge = 0;
  theme = 'default';
  icon = '';
  member = '';
  reason = '';
  title = '';
  newDescription = '';
  newMinimumAge = 0;
  assignedAdmin = '';
  deleteUsername = '';
  reportGroupId = '';
  reportUsername = '';
  reportType = 'ban';
  reportReason = '';
  leaveGroupId = '';
  logActor = '';
  logAction = '';
  logFrom = '';
  logTo = '';
  logActions = ['user created', 'profile updated', 'password changed', 'group created', 'group requested',
    'group request approve', 'group request reject', 'group updated', 'group deleted', 'membership requested',
    'membership approved', 'membership rejected', 'member remove', 'member banned', 'member unban',
    'member promote', 'member demote', 'member leave', 'channel created', 'channel requested',
    'channel request approve', 'channel request reject', 'channel deleted', 'ban requested',
    'deleteUser requested', 'moderation reviewed', 'user deleted', 'message deleted'];

  ngOnChanges() {
    if (!this.currentUser) return;
    this.loadRequests();
    if (this.currentUser.role === 'superAdmin') {
      this.loadUsers();
      this.loadLogs();
    }
    if (this.groupId) this.selectGroup();
  }

  manageableGroups() {
    return this.groups.filter(group =>
      (this.currentUser.role === 'superAdmin' || group.admins.includes(this.currentUser.username)));
  }

  joinedGroups() {
    return this.groups.filter(group => group.members.includes(this.currentUser.username));
  }

  selectedGroup() {
    return this.manageableGroups().find(group => group._id === this.groupId);
  }

  selectGroup() {
    const group = this.selectedGroup();
    this.description = group?.description || '';
    this.minimumAge = group?.minimumAge || 0;
    this.theme = group?.theme || 'default';
    this.icon = group?.icon || '';
    this.member = '';
    this.reason = '';
  }

  reportGroup() {
    return this.joinedGroups().find(group => group._id === this.reportGroupId);
  }

  canReview(request: any) {
    if (request.status !== 'pending' || ['membership', 'channel'].includes(request.type)) return false;
    if (request.type === 'deleteUser') return this.currentUser.role === 'superAdmin';
    return this.currentUser.role !== 'superAdmin' && this.groups.some(group =>
      group._id === request.groupId && group.admins.includes(this.currentUser.username));
  }

  loadUsers() {
    this.adminService.getUsers().subscribe({next: users => this.users.set(users), error: error => this.showError(error)});
  }

  loadRequests() {
    this.adminService.getRequests().subscribe({next: requests => this.requests.set(requests), error: error => this.showError(error)});
  }

  loadLogs() {
    this.adminService.getLogs({actor: this.logActor, action: this.logAction, from: this.logFrom, to: this.logTo})
      .subscribe({next: logs => this.logs.set(logs), error: error => this.showError(error)});
  }

  // All administrative buttons reuse the same response and refresh handling.
  runAction(request: Observable<ApiMessage>) {
    request.subscribe({
      next: response => {
        this.feedback.set(response.message);
        this.changed.emit();
        this.loadRequests();
        if (this.currentUser.role === 'superAdmin') {
          this.loadUsers();
          this.loadLogs();
        }
      },
      error: (error: HttpErrorResponse) => this.showError(error),
    });
  }

  createGroup() {
    this.runAction(this.adminService.createGroup({title: this.title, description: this.newDescription,
      minimumAge: this.newMinimumAge, adminUsername: this.assignedAdmin}));
  }

  saveGroup() {
    this.runAction(this.adminService.updateGroup(this.groupId, {
      description: this.description, minimumAge: this.minimumAge, theme: this.theme, icon: this.icon,
    }));
  }

  selectIcon(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      input.value = '';
      this.feedback.set('Use a PNG, JPEG or GIF icon up to 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.icon = String(reader.result);
    reader.onerror = () => this.feedback.set('Icon could not be opened.');
    reader.readAsDataURL(file);
  }

  rejectJoin(username: string) {
    this.runAction(this.adminService.rejectJoin(this.groupId, username));
  }

  manageMember(action: string) {
    if (['remove', 'ban'].includes(action) && !confirm(`${action} ${this.member} from this group?`)) return;
    this.runAction(this.adminService.manageMember(this.groupId, action, this.member, this.reason));
  }

  deleteGroup() {
    if (confirm('Permanently delete this group, its channels and stored messages?')) {
      this.runAction(this.adminService.deleteGroup(this.groupId));
    }
  }

  deleteChannel(channel: any) {
    if (confirm(`Permanently delete #${channel.name} and its stored messages?`)) {
      this.runAction(this.adminService.deleteChannel(channel._id));
    }
  }

  deleteUser() {
    if (this.deleteUsername && confirm(`Permanently delete the account ${this.deleteUsername}?`)) {
      this.runAction(this.adminService.deleteUser(this.deleteUsername));
    }
  }

  sendReport() {
    this.runAction(this.adminService.requestModeration(this.reportType, this.reportGroupId, this.reportUsername, this.reportReason));
  }

  reviewRequest(request: any, action: string) {
    if (action === 'approve' && !confirm(`${request.type === 'ban' ? 'Ban' : 'Permanently delete'} ${request.targetUsername}?`)) return;
    this.runAction(this.adminService.reviewRequest(request._id, action));
  }

  leaveGroup() {
    if (this.leaveGroupId && confirm('Leave this group? You will need approval to rejoin.')) {
      this.runAction(this.adminService.manageMember(this.leaveGroupId, 'leave', this.currentUser.username));
    }
  }

  private showError(error: HttpErrorResponse) {
    if (error.status === 401) {
      localStorage.removeItem('currentUser');
      this.router.navigate(['/login']);
    }
    this.feedback.set(error.error?.message || 'The action could not be completed.');
  }
}
