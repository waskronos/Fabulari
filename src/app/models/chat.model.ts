export interface JoinChannelData {
  groupTitle: string;
  channelName: string;
}

export interface ChatMessage {
  image?: string;
  _id: string;
  profileImage?: string;
  groupTitle: string;
  channelName: string;
  username: string;
  text: string;
  timestamp: string;
  isModerator: boolean;
}

export interface MessageInput {
  text: string;
  image: string;
}
