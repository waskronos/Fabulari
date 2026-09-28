import { ApiMessage } from './user.model';

export interface GroupRequestData {
  title: string;
  description: string;
  minimumAge: number | null;
  requestedBy: string;
}

export interface PendingGroupRequest {
  id: string;
  type: 'group';
  title: string;
  description: string;
  minimumAge: number;
  requestedBy: string;
  status: 'pending';
  createdAt: string;
}

export interface ChannelRequestData {
  groupTitle: string;
  name: string;
  requestedBy: string;
}

export interface PendingChannelRequest {
  id: string;
  type: 'channel';
  groupTitle: string;
  name: string;
  requestedBy: string;
  status: 'pending';
  createdAt: string;
}

export type RequestDecision = 'approve' | 'reject';

export interface ReviewGroupRequestData {
  action: RequestDecision;
  reviewedBy: string;
}

export type { ApiMessage };
