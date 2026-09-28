export interface JoinChannelData {
  groupTitle: string;
  channelName: string;
  username: string;
}

export interface ChatMessage {
  groupTitle: string;
  channelName: string;
  username: string;
  text: string;
  timestamp: string;
  isModerator: boolean;
}
