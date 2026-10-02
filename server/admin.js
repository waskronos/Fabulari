import { ObjectId } from 'mongodb';
import { getDB } from './db.js';
import { calculateAge } from './access.js';
import { recordAudit } from './audit.js';
import { isValidImage } from './images.js';

function isGroupAdmin(group, user) {
    return user.role !== 'superAdmin' && group.admins.includes(user.username);
}

function isLastAdmin(group, username) {
    return group.admins.includes(username) && group.admins.length === 1;
}

// Close matching live chats as soon as access is removed.
function closeChats(io, groupTitle, username, channelName) {
    for (const socket of io.sockets.sockets.values()) {
        const channel = socket.data.channel;
        if (channel && (!groupTitle || channel.groupTitle === groupTitle) &&
            (!username || channel.username === username) && (!channelName || channel.channelName === channelName)) {
            socket.disconnect(true);
        }
    }
}

async function findGroup(req, res) {
    const id = req.params.groupId || req.body.groupId;
    if (typeof id !== 'string' || !/^[a-f0-9]{24}$/.test(id)) {
        res.status(400).json({message: 'Select a valid group'});
        return null;
    }
    const group = await getDB().collection('groups').findOne({_id: new ObjectId(id)});
    if (!group) res.status(404).json({message: 'Group not found'});
    return group;
}

async function banMember(io, group, username, actor, reason) {
    if (isLastAdmin(group, username)) return 'Appoint another admin before banning this user';
    await getDB().collection('groups').updateOne({_id: group._id}, {
        $pull: {members: username, admins: username, joinRequests: username},
        $addToSet: {bannedMembers: username},
    });
    closeChats(io, group.title, username);
    await getDB().collection('requests').updateMany({
        groupTitle: group.title, requestedBy: username, status: 'pending', type: {$in: ['membership', 'channel']},
    }, {$set: {status: 'rejected', reviewedBy: actor, reviewReason: 'Banned from group', reviewedAt: new Date()}});
    await recordAudit(actor, 'member banned', group.title, `${username}: ${reason}`);
    return null;
}

// Both direct deletion and an approved request use the same last-admin check.
async function deleteUser(io, username, actor, reason) {
    const user = await getDB().collection('users').findOne({username});
    if (!user) return 'User not found';
    if (user.role === 'superAdmin') return 'Super Admin accounts cannot be deleted';
    const groups = await getDB().collection('groups').find({admins: username}).toArray();
    if (groups.some(group => isLastAdmin(group, username))) {
        return 'Appoint another admin in every administered group before deleting this user';
    }
    closeChats(io, null, username);
    await getDB().collection('users').deleteOne({_id: user._id});
    await getDB().collection('groups').updateMany({}, {
        $pull: {members: username, admins: username, joinRequests: username, bannedMembers: username},
    });
    await getDB().collection('messages').deleteMany({username});
    await getDB().collection('requests').updateMany({status: 'pending', $or: [
        {requestedBy: username}, {targetUsername: username},
    ]}, {$set: {status: 'rejected', reviewedBy: actor, reviewReason: 'Account deleted', reviewedAt: new Date()}});
    io.emit('user-deleted', username);
    await recordAudit(actor, 'user deleted', username, reason);
    return null;
}

export default function addAdminRoutes(app, io) {
    app.get('/api/admin/users', async (req, res) => {
        if (req.user.role !== 'superAdmin') return res.status(403).json({message: 'Super Admin access required'});
        const users = await getDB().collection('users').find().project({username: 1, firstName: 1, lastName: 1, role: 1}).toArray();
        res.json(users);
    });

    app.post('/api/groups', async (req, res) => {
        if (req.user.role !== 'superAdmin') return res.status(403).json({message: 'Only Super Admin can create groups directly'});
        const {title, description, minimumAge, adminUsername} = req.body;
        if (typeof title !== 'string' || !title.trim() || title.trim().length > 30 ||
            typeof description !== 'string' || !description.trim() || description.trim().length > 250 ||
            !Number.isInteger(minimumAge) || minimumAge < 0 || typeof adminUsername !== 'string') {
            return res.status(400).json({message: 'Enter a title, description, minimum age and Group Admin'});
        }
        const admin = await getDB().collection('users').findOne({username: adminUsername});
        const age = admin?.dateOfBirth ? calculateAge(admin.dateOfBirth) : admin?.age;
        if (!admin || admin.role === 'superAdmin' || !Number.isFinite(age) || age < minimumAge) {
            return res.status(400).json({message: 'Choose an existing user who meets the minimum age'});
        }
        if (await getDB().collection('groups').findOne({title: title.trim()}, {collation: {locale: 'en', strength: 2}})) {
            return res.status(400).json({message: 'Group title already exists'});
        }
        await getDB().collection('groups').insertOne({
            title: title.trim(), description: description.trim(), minimumAge,
            admins: [admin.username], members: [admin.username], joinRequests: [], bannedMembers: [], theme: 'default',
        });
        await recordAudit(req.user.username, 'group created', title.trim(), `Admin: ${admin.username}`);
        res.status(201).json({message: 'Group created and admin assigned'});
    });

    app.patch('/api/groups/:groupId', async (req, res) => {
        const group = await findGroup(req, res);
        if (!group) return;
        if (!isGroupAdmin(group, req.user)) return res.status(403).json({message: 'Only this group admin can edit its details'});
        const {description, minimumAge, theme = group.theme || 'default', icon = group.icon || ''} = req.body;
        if (typeof description !== 'string' || !description.trim() || description.trim().length > 250 ||
            !Number.isInteger(minimumAge) || minimumAge < 0 || !['default', 'navy', 'plum'].includes(theme)) {
            return res.status(400).json({message: 'Enter a description, valid minimum age and theme'});
        }
        if (!isValidImage(icon)) return res.status(400).json({message: 'Use a PNG, JPEG or GIF icon up to 2 MB'});
        const admins = await getDB().collection('users').find({username: {$in: group.admins}}).toArray();
        if (admins.some(admin => {
            const age = admin.dateOfBirth ? calculateAge(admin.dateOfBirth) : admin.age;
            return !Number.isFinite(age) || age < minimumAge;
        })) {
            return res.status(400).json({message: 'The minimum age cannot exclude an existing Group Admin'});
        }
        await getDB().collection('groups').updateOne({_id: group._id}, {$set: {description: description.trim(), minimumAge, theme, icon}});
        for (const socket of io.sockets.sockets.values()) {
            const channel = socket.data.channel;
            if (!channel || channel.groupTitle !== group.title) continue;
            if (minimumAge !== group.minimumAge) {
                const member = await getDB().collection('users').findOne({username: channel.username});
                const age = member?.dateOfBirth ? calculateAge(member.dateOfBirth) : member?.age;
                if (!Number.isFinite(age) || age < minimumAge) {
                    socket.disconnect(true);
                    continue;
                }
            }
            socket.emit('theme-updated', theme);
        }
        await recordAudit(req.user.username, 'group updated', group.title);
        res.json({message: 'Group details saved'});
    });

    app.post('/api/groups/reject', async (req, res) => {
        const group = await findGroup(req, res);
        if (!group) return;
        const username = req.body.username;
        if (!isGroupAdmin(group, req.user)) return res.status(403).json({message: 'Only this group admin can reject members'});
        if (typeof username !== 'string' || !group.joinRequests.includes(username)) {
            return res.status(400).json({message: 'Pending join request not found'});
        }
        await getDB().collection('groups').updateOne({_id: group._id}, {$pull: {joinRequests: username}});
        await getDB().collection('requests').updateMany({
            type: 'membership', groupTitle: group.title, requestedBy: username, status: 'pending',
        }, {$set: {status: 'rejected', reviewedBy: req.user.username, reviewedAt: new Date()}});
        await recordAudit(req.user.username, 'membership rejected', group.title, username);
        res.json({message: 'Membership request rejected'});
    });

    app.patch('/api/groups/:groupId/members', async (req, res) => {
        const group = await findGroup(req, res);
        if (!group) return;
        const {action, username, reason = ''} = req.body;
        if (!['remove', 'ban', 'unban', 'promote', 'demote', 'leave'].includes(action) ||
            typeof username !== 'string' || typeof reason !== 'string' || reason.length > 250) {
            return res.status(400).json({message: 'Choose a valid member action'});
        }
        const leaving = action === 'leave' && username === req.user.username && req.user.role !== 'superAdmin';
        const assigningAdmin = req.user.role === 'superAdmin' && ['promote', 'demote'].includes(action);
        if (!leaving && !assigningAdmin && !isGroupAdmin(group, req.user)) {
            return res.status(403).json({message: 'You cannot manage this group'});
        }
        if (action === 'unban') {
            if (!(group.bannedMembers || []).includes(username)) return res.status(400).json({message: 'User is not banned'});
            await getDB().collection('groups').updateOne({_id: group._id}, {$pull: {bannedMembers: username}});
        } else {
            if (!group.members.includes(username)) return res.status(400).json({message: 'Group member not found'});
            if (['remove', 'ban', 'demote', 'leave'].includes(action) && isLastAdmin(group, username)) {
                return res.status(400).json({message: 'Appoint another admin before removing the last admin'});
            }
            if (action === 'ban') {
                if (!reason.trim()) return res.status(400).json({message: 'A ban reason is required'});
                const error = await banMember(io, group, username, req.user.username, reason.trim());
                if (error) return res.status(400).json({message: error});
                return res.json({message: 'Member banned from this group'});
            }
            if (action === 'promote') {
                const user = await getDB().collection('users').findOne({username});
                const age = user?.dateOfBirth ? calculateAge(user.dateOfBirth) : user?.age;
                if (!user || user.role === 'superAdmin' || !Number.isFinite(age) || age < group.minimumAge) {
                    return res.status(400).json({message: 'This member does not meet the group requirements'});
                }
                await getDB().collection('groups').updateOne({_id: group._id}, {$addToSet: {admins: username}});
            } else if (action === 'demote') {
                await getDB().collection('groups').updateOne({_id: group._id}, {$pull: {admins: username}});
            } else {
                await getDB().collection('groups').updateOne({_id: group._id}, {$pull: {members: username, admins: username, joinRequests: username}});
                closeChats(io, group.title, username);
            }
        }
        await recordAudit(req.user.username, `member ${action}`, group.title, username);
        res.json({message: 'Group membership updated'});
    });

    app.delete('/api/groups/:groupId', async (req, res) => {
        const group = await findGroup(req, res);
        if (!group) return;
        if (!isGroupAdmin(group, req.user)) return res.status(403).json({message: 'Only this group admin can delete the group'});
        closeChats(io, group.title);
        await getDB().collection('channels').deleteMany({groupTitle: group.title});
        await getDB().collection('messages').deleteMany({groupTitle: group.title});
        await getDB().collection('requests').updateMany({groupTitle: group.title, status: 'pending'}, {$set: {status: 'rejected', reviewedBy: req.user.username, reviewReason: 'Group deleted'}});
        await getDB().collection('groups').deleteOne({_id: group._id});
        await recordAudit(req.user.username, 'group deleted', group.title);
        res.json({message: 'Group and its channels deleted'});
    });

    app.delete('/api/channels/:channelId', async (req, res) => {
        if (!/^[a-f0-9]{24}$/.test(req.params.channelId)) return res.status(400).json({message: 'Invalid channel ID'});
        const channel = await getDB().collection('channels').findOne({_id: new ObjectId(req.params.channelId)});
        if (!channel) return res.status(404).json({message: 'Channel not found'});
        const group = await getDB().collection('groups').findOne({title: channel.groupTitle});
        if (!group || !isGroupAdmin(group, req.user)) return res.status(403).json({message: 'Only this group admin can delete channels'});
        closeChats(io, group.title, null, channel.name);
        await getDB().collection('messages').deleteMany({groupTitle: group.title, channelName: channel.name});
        await getDB().collection('channels').deleteOne({_id: channel._id});
        await getDB().collection('requests').updateMany({
            type: 'channel', groupTitle: group.title, name: channel.name, status: 'pending',
        }, {$set: {status: 'rejected', reviewedBy: req.user.username, reviewReason: 'Channel deleted'}});
        await recordAudit(req.user.username, 'channel deleted', `${group.title}/#${channel.name}`);
        res.json({message: 'Channel deleted'});
    });

    app.delete('/api/users/:username', async (req, res) => {
        if (req.user.role !== 'superAdmin') return res.status(403).json({message: 'Only Super Admin can delete accounts'});
        const error = await deleteUser(io, req.params.username, req.user.username, 'Direct Super Admin deletion');
        if (error) return res.status(400).json({message: error});
        res.json({message: 'User deleted from the application'});
    });

    app.post('/api/moderation-requests', async (req, res) => {
        const group = await findGroup(req, res);
        if (!group) return;
        const {type, targetUsername, reason} = req.body;
        if (!['ban', 'deleteUser'].includes(type) || typeof targetUsername !== 'string' ||
            typeof reason !== 'string' || !reason.trim() || reason.trim().length > 250) {
            return res.status(400).json({message: 'Select a user and provide a reason up to 250 characters'});
        }
        if (req.user.role === 'superAdmin' || !group.members.includes(req.user.username) ||
            (type === 'deleteUser' && !isGroupAdmin(group, req.user))) {
            return res.status(403).json({message: 'You cannot submit this request'});
        }
        const target = await getDB().collection('users').findOne({username: targetUsername});
        if (!target || target.role === 'superAdmin' || targetUsername === req.user.username ||
            (!group.members.includes(targetUsername) && !(type === 'deleteUser' && (group.bannedMembers || []).includes(targetUsername)))) {
            return res.status(400).json({message: 'Select another member of this group'});
        }
        if (await getDB().collection('requests').findOne({type, groupId: group._id.toString(), targetUsername, status: 'pending'})) {
            return res.status(400).json({message: 'A request for this user is already pending'});
        }
        await getDB().collection('requests').insertOne({
            type, groupId: group._id.toString(), groupTitle: group.title, targetUsername,
            reason: reason.trim(), requestedBy: req.user.username, status: 'pending', createdAt: new Date(),
        });
        await recordAudit(req.user.username, `${type} requested`, group.title, `${targetUsername}: ${reason.trim()}`);
        res.status(201).json({message: 'Moderation request submitted'});
    });

    app.get('/api/moderation-requests', async (req, res) => {
        const groups = await getDB().collection('groups').find({admins: req.user.username}).project({_id: 1}).toArray();
        const filter = req.user.role === 'superAdmin' ? {type: 'deleteUser'} : {
            type: {$in: ['membership', 'channel', 'ban', 'deleteUser']}, $or: [
                {requestedBy: req.user.username}, {type: 'ban', groupId: {$in: groups.map(group => group._id.toString())}},
            ],
        };
        res.json(await getDB().collection('requests').find(filter).sort({createdAt: -1}).limit(100).toArray());
    });

    app.patch('/api/moderation-requests/:requestId', async (req, res) => {
        if (!/^[a-f0-9]{24}$/.test(req.params.requestId)) return res.status(400).json({message: 'Invalid request ID'});
        const request = await getDB().collection('requests').findOne({_id: new ObjectId(req.params.requestId), status: 'pending', type: {$in: ['ban', 'deleteUser']}});
        if (!request) return res.status(404).json({message: 'Pending request not found'});
        const {action} = req.body;
        if (!['approve', 'reject'].includes(action)) return res.status(400).json({message: 'Choose approve or reject'});
        const group = await getDB().collection('groups').findOne({_id: new ObjectId(request.groupId)});
        if ((request.type === 'deleteUser' && req.user.role !== 'superAdmin') ||
            (request.type === 'ban' && (!group || !isGroupAdmin(group, req.user)))) {
            return res.status(403).json({message: 'You cannot review this request'});
        }
        if (action === 'approve') {
            if (request.type === 'ban' && !group.members.includes(request.targetUsername)) {
                return res.status(400).json({message: 'This user is no longer a group member'});
            }
            const error = request.type === 'ban'
                ? await banMember(io, group, request.targetUsername, req.user.username, request.reason)
                : await deleteUser(io, request.targetUsername, req.user.username, request.reason);
            if (error) return res.status(400).json({message: error});
        }
        await getDB().collection('requests').updateOne({_id: request._id}, {$set: {
            status: action === 'approve' ? 'approved' : 'rejected', reviewedBy: req.user.username, reviewedAt: new Date(),
        }});
        await recordAudit(req.user.username, 'moderation reviewed', request.groupTitle, `${request.type}: ${request.targetUsername} ${action}`);
        res.json({message: `Request ${action === 'approve' ? 'approved' : 'rejected'}`});
    });

    app.get('/api/audit-logs', async (req, res) => {
        if (req.user.role !== 'superAdmin') return res.status(403).json({message: 'Only Super Admin can view audit logs'});
        const filter = {};
        if (typeof req.query.actor === 'string' && req.query.actor.trim()) filter.actor = req.query.actor.trim();
        if (typeof req.query.action === 'string' && req.query.action.trim()) filter.action = req.query.action.trim();
        if (req.query.from || req.query.to) {
            filter.timestamp = {};
            for (const field of ['from', 'to']) {
                if (!req.query[field]) continue;
                if (typeof req.query[field] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(req.query[field])) {
                    return res.status(400).json({message: 'Use valid dates for the log filter'});
                }
                const date = new Date(`${req.query[field]}T00:00:00`);
                if (Number.isNaN(date.getTime())) return res.status(400).json({message: 'Invalid filter date'});
                if (field === 'to') date.setDate(date.getDate() + 1);
                filter.timestamp[field === 'from' ? '$gte' : '$lt'] = date;
            }
        }
        res.json(await getDB().collection('auditLogs').find(filter).sort({timestamp: -1}).limit(200).toArray());
    });

    // Keep database failures visible instead of returning Express's HTML error page.
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        res.status(500).json({message: 'The action could not be completed. Please try again.'});
    });
}
