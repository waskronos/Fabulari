import { ApiMessage } from './user.model';

export interface GroupRequestData {
  title: string;
  description: string;
  minimumAge: number | null;
  requestedBy: string;
}

export interface PendingGroupRequest {
  _id: string;
  type: 'group';
  title: string;
  description: string;
  minimumAge: number;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface ChannelRequestData {
  groupTitle: string;
  name: string;
  requestedBy: string;
}

export interface PendingChannelRequest {
  _id: string;
  type: 'channel';
  groupTitle: string;
  name: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export type RequestDecision = 'approve' | 'reject';

export type { ApiMessage };
