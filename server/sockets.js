import { getDB } from './db.js';

function getRoomName(groupTitle, channelName) {
    return `${groupTitle.toLowerCase()}:${channelName.toLowerCase()}`;
}

async function getChannelAccess(groupTitle, channelName, username) {
    const [users, groups, channels] = await Promise.all([
        getDB().collection('users').find().toArray(),
        getDB().collection('groups').find().toArray(),
        getDB().collection('channels').find().toArray(),
    ]);
    const cleanGroupTitle = groupTitle.trim().toLowerCase();
    const cleanChannelName = channelName.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase();
    const user = users.find(item => item.username.toLowerCase() === cleanUsername);
    const group = groups.find(item => item.title.toLowerCase() === cleanGroupTitle);
    const channel = channels.find(item =>
        item.groupTitle.toLowerCase() === cleanGroupTitle &&
        item.name.toLowerCase() === cleanChannelName
    );

    if (!user || user.role === 'superAdmin' || !group || !channel) {
        return null;
    }

    const usernameFound = group.members.find(
        member => member.toLowerCase() === cleanUsername
    );

    if (!usernameFound) {
        return null;
    }

    return {
        groupTitle: group.title,
        channelName: channel.name,
        username: usernameFound,
        isModerator: group.admins.some(
            admin => admin.toLowerCase() === cleanUsername
        ),
    };
}

export default function connectSockets(io) {
    io.on('connection', socket => {
        socket.on('join-channel', async joinData => {
            try {
                if (socket.data.channel) {
                    socket.leave(socket.data.channel.roomName);
                    socket.data.channel = null;
                }

                if (!joinData?.groupTitle || !joinData?.channelName || !joinData?.username) {
                    socket.emit('chat-error', 'Channel details are required');
                    return;
                }

                const access = await getChannelAccess(
                    joinData.groupTitle,
                    joinData.channelName,
                    joinData.username
                );

                if (!access) {
                    socket.emit('chat-error', 'You do not have access to this channel');
                    return;
                }

                const roomName = getRoomName(access.groupTitle, access.channelName);
                socket.join(roomName);
                socket.data.channel = { ...access, roomName };
                const messages = await getDB().collection('messages')
                    .find({
                        groupTitle: access.groupTitle,
                        channelName: access.channelName,
                    })
                    .sort({ timestamp: -1 })
                    .limit(5)
                    .toArray();
                socket.emit('chat-history', messages.reverse());
                socket.emit('channel-joined');
            } catch (error) {
                console.error('Error joining channel:', error);
                socket.emit('chat-error', 'Channel could not be opened');
            }
        });

        socket.on('send-message', async messageText => {
            const channel = socket.data.channel;
            const text = String(messageText ?? '').trim();

            if (!channel) {
                socket.emit('chat-error', 'Join a channel before sending a message');
                return;
            }

            if (!text) {
                socket.emit('chat-error', 'Message cannot be empty');
                return;
            }

            try {
                const message = {
                    groupTitle: channel.groupTitle,
                    channelName: channel.channelName,
                    username: channel.username,
                    text,
                    timestamp: new Date(),
                    isModerator: channel.isModerator,
                };

                await getDB().collection('messages').insertOne(message);
                io.to(channel.roomName).emit('new-message', message);
            } catch (error) {
                console.error('Error saving message:', error);
                socket.emit('chat-error', 'Message could not be sent');
            }
        });
    });
}
