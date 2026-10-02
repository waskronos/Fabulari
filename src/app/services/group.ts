import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { sessionOptions } from './access';
import {
    ApiMessage,
    ChannelRequestData,
    GroupRequestData,
    PendingChannelRequest,
    PendingGroupRequest,
    RequestDecision,
} from '../models/group.model';

@Service()
export class Group {
    private http = inject(HttpClient);

    requestGroup(request: GroupRequestData) {
        return this.http.post<ApiMessage>('http://localhost:3000/api/group-requests', request, sessionOptions());
    }

    getGroupRequests(username: string) {
        return this.http.get<PendingGroupRequest[]>('http://localhost:3000/api/group-requests', {
            params: { username },
            ...sessionOptions(),
        });
    }

    reviewGroupRequest(requestId: string, action: RequestDecision, reviewedBy: string) {
        return this.http.patch<ApiMessage>(
            `http://localhost:3000/api/group-requests/${requestId}`,
            { action, reviewedBy }, sessionOptions()
        );
    }

    getGroup(){
        return this.http.get<any[]>('http://localhost:3000/api/groups', sessionOptions());
    }

    requestJoin(title: string, username: string) {
        return this.http.post('http://localhost:3000/api/groups/join', { title, username }, sessionOptions());
    }

    approveJoin(title: string, username: string) {
        return this.http.post('http://localhost:3000/api/groups/approve', { title, username }, sessionOptions());
    }

    createChannel(name: string, groupTitle: string, createdBy: string) {
        return this.http.post<ApiMessage>('http://localhost:3000/api/channels', {
            name,
            groupTitle,
            createdBy,
        }, sessionOptions());
    }

    requestChannel(request: ChannelRequestData) {
        return this.http.post<ApiMessage>('http://localhost:3000/api/channel-requests', request, sessionOptions());
    }

    getChannelRequests(username: string) {
        return this.http.get<PendingChannelRequest[]>('http://localhost:3000/api/channel-requests', {
            params: { username },
            ...sessionOptions(),
        });
    }

    reviewChannelRequest(requestId: string, action: RequestDecision, reviewedBy: string) {
        return this.http.patch<ApiMessage>(
            `http://localhost:3000/api/channel-requests/${requestId}`,
            { action, reviewedBy }, sessionOptions()
        );
    }

    getChannels(){
        return this.http.get<any[]>('http://localhost:3000/api/channels', sessionOptions());
    }
}
