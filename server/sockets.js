import { promises as fs } from 'fs';

function getRoomName(groupTitle, channelName) {
    return `${groupTitle.toLowerCase()}:${channelName.toLowerCase()}`;
}

async function getChannelAccess(groupTitle, channelName, username) {
    const [usersData, groupsData, channelsData] = await Promise.all([
        fs.readFile('./server/data/users.json', 'utf8'),
        fs.readFile('./server/data/groups.json', 'utf8'),
        fs.readFile('./server/data/channels.json', 'utf8'),
    ]);
    const users = JSON.parse(usersData);
    const groups = JSON.parse(groupsData);
    const channels = JSON.parse(channelsData);
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
                socket.emit('channel-joined');
            } catch (error) {
                console.error('Error joining channel:', error);
                socket.emit('chat-error', 'Channel could not be opened');
            }
        });

        socket.on('send-message', messageText => {
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

            io.to(channel.roomName).emit('new-message', {
                groupTitle: channel.groupTitle,
                channelName: channel.channelName,
                username: channel.username,
                text,
                timestamp: new Date().toISOString(),
                isModerator: channel.isModerator,
            });
        });
    });
}
