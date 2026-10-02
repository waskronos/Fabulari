import { ObjectId } from 'mongodb';
import { getDB } from './db.js';
import { calculateAge, getSessionUser } from './access.js';
import { isValidImage } from './images.js';
import { recordAudit } from './audit.js';

function getRoomName(groupTitle, channelName) {
    return `${groupTitle.toLowerCase()}:${channelName.toLowerCase()}`;
}

// Use the logged-in account, then check this group's membership and age.
async function getChannelAccess(groupTitle, channelName, token) {
    const user = await getSessionUser(token);
    if (!user || user.role === 'superAdmin') return null;
    const group = await getDB().collection('groups').findOne({title: groupTitle});
    const channel = await getDB().collection('channels').findOne({groupTitle, name: channelName});
    const age = user.dateOfBirth ? calculateAge(user.dateOfBirth) : user.age;
    if (!group || !channel || !group.members.includes(user.username) ||
        !Number.isFinite(age) || age < group.minimumAge || (group.bannedMembers || []).includes(user.username)) return null;
    return {
        groupTitle: group.title, channelName: channel.name, username: user.username,
        isModerator: group.admins.includes(user.username), profileImage: user.profileImage || '',
        theme: group.theme || 'default',
    };
}

// Keep five database messages without removing older messages from open chats.
async function trimHistory(channel) {
    const older = await getDB().collection('messages')
        .find({groupTitle: channel.groupTitle, channelName: channel.channelName})
        .sort({timestamp: -1, _id: -1}).skip(5).project({_id: 1}).toArray();
    if (older.length) {
        await getDB().collection('messages').deleteMany({_id: {$in: older.map(message => message._id)}});
    }
}

export default function connectSockets(io) {
    // Ownership survives database trimming while people still have the room open.
    const messageOwners = new Map();

    function leaveChannel(socket) {
        const channel = socket.data.channel;
        if (!channel) return;
        socket.to(channel.roomName).emit('room-notification', `${channel.username} left the room`);
        socket.leave(channel.roomName);
        socket.data.channel = null;
        if (!io.sockets.adapter.rooms.has(channel.roomName)) messageOwners.delete(channel.roomName);
    }

    io.use(async (socket, next) => {
        try {
            if (!await getSessionUser(socket.handshake.auth.token)) {
                return next(new Error('Please sign in again'));
            }
            next();
        } catch {
            next(new Error('Login could not be checked'));
        }
    });

    io.on('connection', socket => {
        socket.on('join-channel', async joinData => {
            try {
                leaveChannel(socket);
                const joinNumber = (socket.data.joinNumber || 0) + 1;
                socket.data.joinNumber = joinNumber;
                if (typeof joinData?.groupTitle !== 'string' || typeof joinData?.channelName !== 'string') {
                    socket.emit('chat-error', 'Channel details are required');
                    return;
                }

                const access = await getChannelAccess(
                    joinData.groupTitle,
                    joinData.channelName,
                    socket.handshake.auth.token
                );

                if (!access) {
                    socket.emit('chat-error', 'You do not have access to this channel');
                    return;
                }

                const roomName = getRoomName(access.groupTitle, access.channelName);
                await trimHistory(access);
                const messages = await getDB().collection('messages')
                    .find({
                        groupTitle: access.groupTitle,
                        channelName: access.channelName,
                    })
                    .sort({ timestamp: -1, _id: -1 })
                    .limit(5)
                    .toArray();
                const users = await getDB().collection('users').find({
                    username: {$in: messages.map(message => message.username)},
                }).project({username: 1, profileImage: 1}).toArray();
                if (!socket.connected || socket.data.joinNumber !== joinNumber) return;
                socket.join(roomName);
                socket.data.channel = { ...access, roomName };
                if (!messageOwners.has(roomName)) messageOwners.set(roomName, new Map());
                const history = messages.reverse().map(message => {
                    const id = message._id.toString();
                    messageOwners.get(roomName).set(id, message.username);
                    return {...message, profileImage: users.find(user => user.username === message.username)?.profileImage || ''};
                });
                socket.emit('chat-history', history);
                socket.emit('channel-joined', {theme: access.theme});
                socket.to(roomName).emit('room-notification', `${access.username} joined the room`);
            } catch (error) {
                socket.emit('chat-error', 'Channel could not be opened');
            }
        });

        socket.on('send-message', async (payload, callback) => {
            function fail(message) {
                socket.emit('chat-error', message);
                if (typeof callback === 'function') callback(false);
            }
            const channel = socket.data.channel;
            const messageText = typeof payload === 'string' ? payload : payload?.text;
            const text = typeof messageText === 'string' ? messageText.trim() : '';
            const image = typeof payload === 'string' ? '' : payload?.image ?? '';

            if (!channel) {
                fail('Join a channel before sending a message');
                return;
            }

            if ((!text && !image) || typeof messageText !== 'string' || text.length > 2000) {
                fail('Add text or an image. Text can contain up to 2000 characters');
                return;
            }
            if (!isValidImage(image)) {
                fail('Use a PNG, JPEG or GIF image up to 2 MB');
                return;
            }

            try {
                const access = await getChannelAccess(channel.groupTitle, channel.channelName, socket.handshake.auth.token);
                if (!access || !socket.connected || socket.data.channel !== channel) {
                    leaveChannel(socket);
                    socket.emit('channel-left');
                    fail('You no longer have access to this channel');
                    return;
                }
                const message = {
                    groupTitle: channel.groupTitle,
                    channelName: channel.channelName,
                    username: channel.username,
                    text,
                    image,
                    timestamp: new Date(),
                    isModerator: access.isModerator,
                };

                await getDB().collection('messages').insertOne(message);
                const id = message._id.toString();
                messageOwners.get(channel.roomName)?.set(id, access.username);
                await trimHistory(channel);
                io.to(channel.roomName).emit('new-message', {...message, profileImage: access.profileImage});
                if (typeof callback === 'function') callback(true);
            } catch (error) {
                fail('Message could not be sent');
            }
        });

        socket.on('delete-message', async id => {
            const channel = socket.data.channel;
            if (!channel || typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) {
                return socket.emit('chat-error', 'Select a message in this channel');
            }
            try {
                const access = await getChannelAccess(channel.groupTitle, channel.channelName, socket.handshake.auth.token);
                if (!access || !socket.connected || socket.data.channel !== channel) {
                    leaveChannel(socket);
                    socket.emit('channel-left');
                    return socket.emit('chat-error', 'You no longer have access to this channel');
                }
                if (messageOwners.get(channel.roomName)?.get(id) !== access.username) {
                    return socket.emit('chat-error', 'You can only delete your own messages in this room');
                }
                await getDB().collection('messages').deleteOne({
                    _id: new ObjectId(id), username: access.username,
                    groupTitle: access.groupTitle, channelName: access.channelName,
                });
                messageOwners.get(channel.roomName)?.delete(id);
                await recordAudit(access.username, 'message deleted', `${access.groupTitle}/#${access.channelName}`, id);
                io.to(channel.roomName).emit('message-deleted', id);
            } catch {
                socket.emit('chat-error', 'Message could not be deleted');
            }
        });
        socket.on('disconnecting', () => leaveChannel(socket));
    });
}
