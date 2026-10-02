import { inject, Service } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { sessionOptions } from './access';
import { ApiMessage } from '../models/user.model';

@Service()
export class Admin {
  private http = inject(HttpClient);
  private url = 'http://localhost:3000/api';

  getUsers() {
    return this.http.get<any[]>(`${this.url}/admin/users`, sessionOptions());
  }

  createGroup(group: {title: string; description: string; minimumAge: number; adminUsername: string}) {
    return this.http.post<ApiMessage>(`${this.url}/groups`, group, sessionOptions());
  }

  updateGroup(id: string, details: {description: string; minimumAge: number; theme: string; icon?: string}) {
    return this.http.patch<ApiMessage>(`${this.url}/groups/${id}`, details, sessionOptions());
  }

  rejectJoin(groupId: string, username: string) {
    return this.http.post<ApiMessage>(`${this.url}/groups/reject`, {groupId, username}, sessionOptions());
  }

  manageMember(id: string, action: string, username: string, reason = '') {
    return this.http.patch<ApiMessage>(`${this.url}/groups/${id}/members`, {action, username, reason}, sessionOptions());
  }

  deleteGroup(id: string) {
    return this.http.delete<ApiMessage>(`${this.url}/groups/${id}`, sessionOptions());
  }

  deleteChannel(id: string) {
    return this.http.delete<ApiMessage>(`${this.url}/channels/${id}`, sessionOptions());
  }

  deleteUser(username: string) {
    return this.http.delete<ApiMessage>(`${this.url}/users/${encodeURIComponent(username)}`, sessionOptions());
  }

  getRequests() {
    return this.http.get<any[]>(`${this.url}/moderation-requests`, sessionOptions());
  }

  requestModeration(type: string, groupId: string, targetUsername: string, reason: string) {
    return this.http.post<ApiMessage>(`${this.url}/moderation-requests`, {type, groupId, targetUsername, reason}, sessionOptions());
  }

  reviewRequest(id: string, action: string) {
    return this.http.patch<ApiMessage>(`${this.url}/moderation-requests/${id}`, {action}, sessionOptions());
  }

  getLogs(filters: {actor: string; action: string; from: string; to: string}) {
    return this.http.get<any[]>(`${this.url}/audit-logs`, {...sessionOptions(), params: filters});
  }
}
