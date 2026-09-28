import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
        return this.http.post<ApiMessage>('http://localhost:3000/api/group-requests', request);
    }

    getGroupRequests(username: string) {
        return this.http.get<PendingGroupRequest[]>('http://localhost:3000/api/group-requests', {
            params: { username },
        });
    }

    reviewGroupRequest(requestId: string, action: RequestDecision, reviewedBy: string) {
        return this.http.patch<ApiMessage>(
            `http://localhost:3000/api/group-requests/${requestId}`,
            { action, reviewedBy }
        );
    }

    getGroup(){
        return this.http.get<any[]>('http://localhost:3000/api/groups');
    }

    requestJoin(title: string, username: string) {
        return this.http.post('http://localhost:3000/api/groups/join', { title, username });
    }

    approveJoin(title: string, username: string) {
        return this.http.post('http://localhost:3000/api/groups/approve', { title, username });
    }

    createChannel(name: string, groupTitle: string, createdBy: string) {
        return this.http.post<ApiMessage>('http://localhost:3000/api/channels', {
            name,
            groupTitle,
            createdBy,
        });
    }

    requestChannel(request: ChannelRequestData) {
        return this.http.post<ApiMessage>('http://localhost:3000/api/channel-requests', request);
    }

    getChannelRequests(username: string) {
        return this.http.get<PendingChannelRequest[]>('http://localhost:3000/api/channel-requests', {
            params: { username },
        });
    }

    reviewChannelRequest(requestId: string, action: RequestDecision, reviewedBy: string) {
        return this.http.patch<ApiMessage>(
            `http://localhost:3000/api/channel-requests/${requestId}`,
            { action, reviewedBy }
        );
    }

    getChannels(){
        return this.http.get<any[]>('http://localhost:3000/api/channels');
    }
}
