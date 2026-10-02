import express from 'express';
import cors from 'cors';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import {
    connectDB,
    getDB,
} from './db.js';
import connectSockets from './sockets.js';
import { calculateAge, createSession, endSession, getSessionUser } from './access.js';
import { isValidImage } from './images.js';
import { recordAudit } from './audit.js';
import addAdminRoutes from './admin.js';

const app = express();
const port = Number(process.env.HTTP_PORT) || 3000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
    maxHttpBufferSize: 3 * 1024 * 1024,
    cors: {
        origin: 'http://localhost:4200',
        methods: ['GET', 'POST'],
    },
});

connectSockets(io);

app.use(cors());
app.use(express.json({ limit: '3mb' }));

// Check the login before checking permissions on individual routes.
app.use('/api', async (req, res, next) => {
    if (req.method === 'POST' && ['/login', '/users'].includes(req.path)) return next();
    try {
        const token = req.headers.authorization?.replace(/^Bearer /, '');
        const user = await getSessionUser(token);
        if (!user) return res.status(401).json({message: 'Please sign in again'});
        req.user = user;
        req.sessionToken = token;
        const actors = [req.body?.requestedBy, req.body?.reviewedBy, req.body?.createdBy, req.query.username];
        if (req.path === '/groups/join') actors.push(req.body?.username);
        if (actors.some(actor => actor !== undefined && actor !== user.username)) {
            return res.status(403).json({message: 'You cannot act as another user'});
        }
        return next();
    } catch (error) {
        return res.status(500).json({message: 'Login could not be checked'});
    }
});

app.post('/api/logout', (req, res) => {
    endSession(req.sessionToken);
    for (const socket of io.sockets.sockets.values()) {
        if (socket.handshake.auth.token === req.sessionToken) socket.disconnect(true);
    }
    res.json({message: 'Logged out'});
});

app.post('/api/users', async (req, res) => {
    const {username, firstName, lastName, email, dateOfBirth, password} = req.body;
    const newUser = {username, firstName, lastName, email, dateOfBirth, password};
    if (!Object.values(newUser).every(value => typeof value === 'string')) {
        return res.status(400).json({message: 'Please enter valid registration details'});
    }
    if (!newUser.username ||
         !newUser.firstName ||
          !newUser.lastName ||
           !newUser.email ||
             !newUser.dateOfBirth ||
             !newUser.password){

            return res.status(400).json({message: 'All fields are mandatory!'})};

    if (newUser.password.length < 8) {
        return res.status(400).json({message: 'Password must be at least 8 characters'});
    }
    if (Buffer.byteLength(newUser.password) > 72) {
        return res.status(400).json({message: 'Password cannot exceed 72 bytes'});
    }
    
    if(!/[A-Z]/.test(newUser.password)){
        return res.status(400).json({message: 'Password must contain at least one uppercase letter'
        });
    };

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; 
    if(!emailRegex.test(newUser.email)){
        return res.status(400).json({message: 'Invalid email format'});
    };

    const birthDate = new Date(`${newUser.dateOfBirth}T00:00:00`);
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
        return res.status(400).json({message: 'Please enter a valid date of birth'});
    }

    try {
        const users = getDB().collection('users');
        newUser.email = newUser.email.trim().toLowerCase();
        newUser.username = newUser.username.trim();
        newUser.firstName = newUser.firstName.trim();
        newUser.lastName = newUser.lastName.trim();

        if (!newUser.username ||
         !newUser.firstName ||
          !newUser.lastName ||
           !newUser.email){
            return res.status(400).json({message: 'All fields are mandatory!'})};

        const emailExists = await users.findOne({email: newUser.email});
        const usernameExists = await users.findOne({username: newUser.username}, {collation: {locale: 'en', strength: 2}});

        if(emailExists){
            return res.status(400).json({message: 'Email already exists'});
        }
        if(usernameExists){
            return res.status(400).json({message: 'Username already exists'});
        }

        if (await users.countDocuments() === 0)
            { newUser.role = 'superAdmin';
             } else{
                newUser.role = 'user';
             };
             
             
             const hashedPassword = await bcrypt.hash(newUser.password, 10);
             newUser.password = hashedPassword;
             
             await getDB().collection('users').insertOne(newUser);
             await recordAudit(newUser.username, 'user created', newUser.username);
             return res.json({message: 'User added successfully'});
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({message: 'Failed to save user data'});
    }
});

app.post('/api/login', async (req, res) => {
    const loginData = req.body;

    if (typeof loginData.username !== 'string' || typeof loginData.password !== 'string' ||
        !loginData.username.trim() || !loginData.password) {
        return res.status(400).json({ message: 'Please fill both fields' });
    }

    try {
        const user = await getDB().collection('users').findOne(
            {username: loginData.username.trim()}, {collation: {locale: 'en', strength: 2}}
        );

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const passwordMatch = await bcrypt.compare(loginData.password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }


        return res.json({
            message: 'Login successful',
            user: {
                username: user.username,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                dateOfBirth: user.dateOfBirth,
                age: user.dateOfBirth ? calculateAge(user.dateOfBirth) : user.age,
                role: user.role,
                profileImage: user.profileImage || '',
                sessionToken: createSession(user.username),
            },
        });
    } catch (error) {
        console.error('Error logging in:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});


app.patch('/api/users/:username', async (req, res) => {
    if (req.params.username !== req.user.username) {
        return res.status(403).json({message: 'You can only update your own profile'});
    }
    const { firstName, lastName, email, dateOfBirth, currentPassword } = req.body;
    const profileImage = req.body.profileImage ?? req.user.profileImage ?? '';
    if (!isValidImage(profileImage)) {
        return res.status(400).json({message: 'Use a PNG, JPEG or GIF image up to 2 MB'});
    }
    if (![firstName, lastName, email, dateOfBirth, currentPassword]
        .every(value => typeof value === 'string' && value.trim())) {
        return res.status(400).json({message: 'All profile fields and your current password are required'});
    }

    const cleanEmail = email.trim().toLowerCase();
    if (firstName.trim().length > 80 || lastName.trim().length > 80 || cleanEmail.length > 254) {
        return res.status(400).json({message: 'Please use shorter profile details'});
    }
    const birthDate = new Date(`${dateOfBirth}T00:00:00`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({message: 'Invalid email format'});
    }
    if (Number.isNaN(birthDate.getTime()) || birthDate > new Date() ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) ||
        birthDate.getFullYear() !== Number(dateOfBirth.slice(0, 4)) ||
        birthDate.getMonth() + 1 !== Number(dateOfBirth.slice(5, 7)) ||
        birthDate.getDate() !== Number(dateOfBirth.slice(8, 10))) {
        return res.status(400).json({message: 'Please enter a valid date of birth'});
    }

    try {
        const users = getDB().collection('users');
        const user = await users.findOne({username: req.params.username});
        if (!user || !await bcrypt.compare(currentPassword, user.password)) {
            return res.status(403).json({message: 'Your current password is incorrect'});
        }
        if (cleanEmail !== user.email) {
            return res.status(400).json({message: 'Your email cannot be changed'});
        }

        const profile = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: cleanEmail,
            dateOfBirth,
            profileImage,
        };
        await users.updateOne({ _id: user._id }, { $set: profile });
        await recordAudit(user.username, 'profile updated', user.username);
        if (dateOfBirth !== user.dateOfBirth) {
            for (const socket of io.sockets.sockets.values()) {
                if (socket.data.channel?.username === user.username) socket.disconnect(true);
            }
        }
        return res.json({
            message: 'Profile updated successfully',
            user: {
                username: user.username,
                ...profile,
                age: calculateAge(dateOfBirth),
                role: user.role,
                sessionToken: req.sessionToken,
            },
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({message: 'Profile could not be saved'});
    }
});

// Change only the logged-in user's password after checking their current one.
app.patch('/api/users/:username/password', async (req, res) => {
    if (req.params.username !== req.user.username) {
        return res.status(403).json({message: 'You can only change your own password'});
    }
    const {currentPassword, newPassword, confirmPassword} = req.body;
    if (![currentPassword, newPassword, confirmPassword].every(value => typeof value === 'string' && value)) {
        return res.status(400).json({message: 'Please fill all password fields'});
    }
    if (newPassword !== confirmPassword) {
        return res.status(400).json({message: 'New passwords do not match'});
    }
    if (newPassword.length < 8 || newPassword.length > 72 || !/[A-Z]/.test(newPassword) ||
        Buffer.byteLength(newPassword) > 72) {
        return res.status(400).json({message: 'Use 8–72 characters with at least one uppercase letter (maximum 72 bytes)'});
    }
    if (newPassword === currentPassword) {
        return res.status(400).json({message: 'Choose a different new password'});
    }
    try {
        if (!await bcrypt.compare(currentPassword, req.user.password)) {
            return res.status(403).json({message: 'Your current password is incorrect'});
        }
        const password = await bcrypt.hash(newPassword, 10);
        await getDB().collection('users').updateOne({_id: req.user._id}, {$set: {password}});
        await recordAudit(req.user.username, 'password changed', req.user.username);
        return res.json({message: 'Password updated successfully'});
    } catch {
        return res.status(500).json({message: 'Password could not be changed'});
    }
});

app.get('/api/groups', async (_req, res) => {
    try {
        const groups = await getDB().collection('groups').find().toArray();
        return res.status(200).json(groups);
    } catch (error) {
        console.error('Error loading groups:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
});

app.post('/api/group-requests', async (req, res) => {
    const { title, description, minimumAge, requestedBy } = req.body;

    if (!title?.trim() || !description?.trim() || minimumAge === null ||
        minimumAge === undefined || !requestedBy?.trim()) {
        return res.status(400).json({message: 'All fields are mandatory!'});
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    const numericMinimumAge = Number(minimumAge);

    if (cleanTitle.length > 30) {
        return res.status(400).json({message: 'Group title cannot exceed 30 characters'});
    }
    if (cleanDescription.length > 250) {
        return res.status(400).json({message: 'Group description cannot exceed 250 characters'});
    }
    if (!Number.isInteger(numericMinimumAge) || numericMinimumAge < 0) {
        return res.status(400).json({message: 'Minimum age must be a positive whole number'});
    }

    try {
        const requester = req.user;
        const groupExists = await getDB().collection('groups').findOne(
            {title: cleanTitle}, {collation: {locale: 'en', strength: 2}}
        );

        if (!requester) {
            return res.status(404).json({message: 'User not found'});
        }
        if (requester.role === 'superAdmin') {
            return res.status(400).json({message: 'Super Admin cannot request a group'});
        }
        const age = requester.dateOfBirth ? calculateAge(requester.dateOfBirth) : requester.age;
        if (!Number.isFinite(age) || age < numericMinimumAge) {
            return res.status(400).json({message: 'You must meet your requested group\'s minimum age'});
        }
        if (groupExists) {
            return res.status(400).json({message: 'Group title already exists'});
        }

        const duplicateRequest = await getDB().collection('requests').findOne(
            {type: 'group', status: 'pending', title: cleanTitle},
            {collation: {locale: 'en', strength: 2}}
        );
        if (duplicateRequest) {
            return res.status(400).json({message: 'A request for this group title is already pending'});
        }

        await getDB().collection('requests').insertOne({
            type: 'group',
            title: cleanTitle,
            description: cleanDescription,
            minimumAge: numericMinimumAge,
            requestedBy: requester.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });

        await recordAudit(req.user.username, 'group requested', cleanTitle);
        return res.status(201).json({message: 'Group request sent to the Super Admin'});
    } catch (error) {
        console.error('Error creating group request:', error);
        return res.status(500).json({message: 'Failed to save group request'});
    }
});

app.get('/api/group-requests', async (req, res) => {
    const username = String(req.query.username ?? '').trim();

    try {
        const currentUser = req.user;

        if (!currentUser) {
            return res.status(404).json({message: 'User not found'});
        }

        const filter = currentUser.role === 'superAdmin'
            ? {type: 'group', status: 'pending'}
            : {type: 'group', requestedBy: currentUser.username};
        return res.status(200).json(await getDB().collection('requests').find(filter).toArray());
    } catch (error) {
        console.error('Error loading group requests:', error);
        return res.status(500).json({message: 'Failed to load group requests'});
    }
});

app.patch('/api/group-requests/:requestId', async (req, res) => {
    const { action, reviewedBy } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({message: 'Action must be approve or reject'});
    }

    try {
        const reviewer = req.user;

        if (!reviewer || reviewer.role !== 'superAdmin') {
            return res.status(403).json({message: 'Only the Super Admin can review group requests'});
        }

        if (!/^[a-f0-9]{24}$/.test(req.params.requestId)) {
            return res.status(400).json({message: 'Invalid request ID'});
        }
        const request = await getDB().collection('requests').findOne({_id: new ObjectId(req.params.requestId)});
        if (!request || request.type !== 'group' || request.status !== 'pending') {
            return res.status(404).json({message: 'Pending group request not found'});
        }

        if (action === 'approve') {
            const existingGroup = await getDB().collection('groups').findOne(
                {title: request.title}, {collation: {locale: 'en', strength: 2}}
            );
            if (existingGroup) {
                return res.status(400).json({message: 'Group title already exists'});
            }

            const requester = await getDB().collection('users').findOne({username: request.requestedBy});
            if (!requester) {
                return res.status(404).json({message: 'Requesting user no longer exists'});
            }

            await getDB().collection('groups').insertOne({
                title: request.title,
                description: request.description,
                minimumAge: request.minimumAge,
                admins: [requester.username],
                members: [requester.username],
                joinRequests: [],
                bannedMembers: [],
                theme: 'default',
            });
        }

        await getDB().collection('requests').updateOne(
            { _id: request._id },
            {
                $set: {
                    status: action === 'approve' ? 'approved' : 'rejected',
                    reviewedBy: reviewer.username,
                    reviewedAt: new Date().toISOString(),
                },
            }
        );

        await recordAudit(req.user.username, `group request ${action}`, request.title);
        return res.status(200).json({
            message: action === 'approve' ? 'Group request approved' : 'Group request rejected'
        });
    } catch (error) {
        console.error('Error reviewing group request:', error);
        return res.status(500).json({message: 'Failed to review group request'});
    }
});

app.post('/api/groups/join', async (req, res) => {
    const joinData = req.body;
    if(typeof joinData.title !== 'string' || typeof joinData.username !== 'string' ||
        !joinData.title.trim() || !joinData.username.trim()) {
        return res.status(400).json({message: 'Group title and username are required'});
    }  

    try {
        const userFound = req.user;
        if(!userFound) {
            return res.status(404).json({message: 'User not found'});
        }
        if (userFound.role === 'superAdmin') {
            return res.status(403).json({message: 'Super Admin cannot join groups'});
        }

        const groupFound = await getDB().collection('groups').findOne(
            {title: joinData.title}, {collation: {locale: 'en', strength: 2}}
        );
        if(!groupFound) {
                return res.status(404).json({message: 'Group not found'});
        }
        if ((groupFound.bannedMembers || []).includes(userFound.username)) {
            return res.status(403).json({message: 'You are banned from this group'});
        }

        const userAge = userFound.dateOfBirth
            ? calculateAge(userFound.dateOfBirth)
            : userFound.age;

        if(!Number.isFinite(userAge) || userAge < groupFound.minimumAge){
            return res.status(400).json({message: 'User does not meet the minimum age requirement for this group'});
        }

        if(groupFound.members.includes(userFound.username)){
            return res.status(400).json({message: 'User is already a member of this group'});
        }

        if(groupFound.joinRequests.includes(userFound.username)){
            return res.status(400).json({message: 'User has already requested to join this group'});
        }

        await getDB().collection('groups').updateOne(
            { _id: groupFound._id },
            { $addToSet: { joinRequests: userFound.username } }
        );
        await getDB().collection('requests').insertOne({
            type: 'membership', groupId: groupFound._id.toString(), groupTitle: groupFound.title,
            requestedBy: userFound.username, targetUsername: userFound.username,
            reason: 'Request to join this group', status: 'pending', createdAt: new Date(),
        });
        await recordAudit(req.user.username, 'membership requested', groupFound.title);
        return res.status(200).json({message: 'Join request sent successfully'});
    } catch (error) {
        console.error('Error requesting group membership:', error);
        return res.status(500).json({message: 'Failed to update group data'});
    }
});


app.post('/api/groups/approve', async (req, res) => {
    const approvalData = req.body;

    if(typeof approvalData.title !== 'string' || typeof approvalData.username !== 'string' ||
        !approvalData.title.trim() || !approvalData.username.trim()){
        return res.status(400).json({message: 'Group title and username are required'});
    }

    try {
        const groupFound = await getDB().collection('groups').findOne(
            {title: approvalData.title}, {collation: {locale: 'en', strength: 2}}
        );

        if(!groupFound){
            return res.status(404).json({message: 'Group not found'});
        }

        if (req.user.role === 'superAdmin' || !groupFound.admins.includes(req.user.username)) {
            return res.status(403).json({message: 'Only this group admin can approve members'});
        }
        const applicant = await getDB().collection('users').findOne({username: approvalData.username});
        const age = applicant?.dateOfBirth ? calculateAge(applicant.dateOfBirth) : applicant?.age;
        if (!applicant || applicant.role === 'superAdmin' || !Number.isFinite(age) || age < groupFound.minimumAge ||
            (groupFound.bannedMembers || []).includes(approvalData.username)) {
            return res.status(400).json({message: 'User does not meet this group\'s requirements'});
        }

        const requestIndex = groupFound.joinRequests.indexOf(approvalData.username);

        if(requestIndex === -1){
            return res.status(400).json({message: 'No join request from this user'});
        }

        await getDB().collection('groups').updateOne(
            { _id: groupFound._id },
            {
                $pull: { joinRequests: approvalData.username },
                $addToSet: { members: approvalData.username },
            }
        );
        await getDB().collection('requests').updateMany({
            type: 'membership', groupTitle: groupFound.title, requestedBy: approvalData.username, status: 'pending',
        }, {$set: {status: 'approved', reviewedBy: req.user.username, reviewedAt: new Date()}});
        await recordAudit(req.user.username, 'membership approved', groupFound.title, approvalData.username);
        return res.status(200).json({message: 'User added to group successfully'});
    } catch (error) {
        console.error('Error approving group membership:', error);
        return res.status(500).json({message: 'Failed to update group data'});
    }
});

app.post('/api/channels', async (req, res) => {
    const { name, groupTitle, createdBy } = req.body;

    if (!name?.trim() || !groupTitle?.trim() || !createdBy?.trim()) {
        return res.status(400).json({message: 'All fields are mandatory!'});
    }

    try {
        const groupFound = await getDB().collection('groups').findOne(
            {title: groupTitle.trim()}, {collation: {locale: 'en', strength: 2}}
        );

        if (!groupFound) {
            return res.status(404).json({message: 'Group not found'});
        }

        const groupAdmin = req.user.role !== 'superAdmin' && groupFound.admins.includes(req.user.username)
            ? req.user.username : null;
        if (!groupAdmin) {
            return res.status(403).json({message: 'Only this group\'s admins can create channels'});
        }

        const cleanName = name.trim();
        const channelExists = await getDB().collection('channels').findOne(
            {name: cleanName, groupTitle: groupFound.title}, {collation: {locale: 'en', strength: 2}}
        );
        if (channelExists) {
            return res.status(400).json({message: 'Channel already exists in this group'});
        }

        await getDB().collection('channels').insertOne({
            name: cleanName,
            groupTitle: groupFound.title,
            createdBy: groupAdmin,
        });

        await recordAudit(req.user.username, 'channel created', `${groupFound.title}/#${cleanName}`);
        return res.status(201).json({message: 'Channel created successfully'});
    } catch (error) {
        console.error('Error creating channel:', error);
        return res.status(500).json({message: 'Failed to create channel'});
    }
});

app.post('/api/channel-requests', async (req, res) => {
    const { name, groupTitle, requestedBy } = req.body;

    if (!name?.trim() || !groupTitle?.trim() || !requestedBy?.trim()) {
        return res.status(400).json({message: 'All fields are mandatory!'});
    }

    try {
        const requester = req.user;
        const groupFound = await getDB().collection('groups').findOne(
            {title: groupTitle.trim()}, {collation: {locale: 'en', strength: 2}}
        );

        if (!requester) {
            return res.status(404).json({message: 'User not found'});
        }
        if (!groupFound) {
            return res.status(404).json({message: 'Group not found'});
        }
        if (requester.role === 'superAdmin' || !groupFound.members.includes(requester.username)) {
            return res.status(403).json({message: 'Only group members can request channels'});
        }
        const age = requester.dateOfBirth ? calculateAge(requester.dateOfBirth) : requester.age;
        if (!Number.isFinite(age) || age < groupFound.minimumAge || (groupFound.bannedMembers || []).includes(requester.username)) {
            return res.status(403).json({message: 'You no longer meet this group\'s requirements'});
        }
        if (groupFound.admins.includes(requester.username)) {
            return res.status(400).json({message: 'Group admins can create channels directly'});
        }

        const cleanName = name.trim();
        const channelExists = await getDB().collection('channels').findOne(
            {name: cleanName, groupTitle: groupFound.title}, {collation: {locale: 'en', strength: 2}}
        );
        if (channelExists) {
            return res.status(400).json({message: 'Channel already exists in this group'});
        }

        const duplicateRequest = await getDB().collection('requests').findOne(
            {type: 'channel', status: 'pending', name: cleanName, groupTitle: groupFound.title},
            {collation: {locale: 'en', strength: 2}}
        );
        if (duplicateRequest) {
            return res.status(400).json({message: 'This channel request is already pending'});
        }

        await getDB().collection('requests').insertOne({
            type: 'channel',
            groupTitle: groupFound.title,
            name: cleanName,
            requestedBy: requester.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });

        await recordAudit(req.user.username, 'channel requested', `${groupFound.title}/#${cleanName}`);
        return res.status(201).json({message: 'Channel request sent to the Group Admin'});
    } catch (error) {
        console.error('Error creating channel request:', error);
        return res.status(500).json({message: 'Failed to save channel request'});
    }
});

app.get('/api/channel-requests', async (req, res) => {
    const username = String(req.query.username ?? '').trim().toLowerCase();

    try {
        const groups = await getDB().collection('groups').find({admins: req.user.username}).toArray();
        const adminGroupTitles = groups.map(group => group.title);
        const pendingRequests = req.user.role === 'superAdmin' ? []
            : await getDB().collection('requests').find({
                type: 'channel', status: 'pending', groupTitle: {$in: adminGroupTitles},
            }).toArray();

        return res.status(200).json(pendingRequests);
    } catch (error) {
        console.error('Error loading channel requests:', error);
        return res.status(500).json({message: 'Failed to load channel requests'});
    }
});

app.patch('/api/channel-requests/:requestId', async (req, res) => {
    const { action, reviewedBy } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({message: 'Action must be approve or reject'});
    }

    try {
        if (!/^[a-f0-9]{24}$/.test(req.params.requestId)) {
            return res.status(400).json({message: 'Invalid request ID'});
        }
        const request = await getDB().collection('requests').findOne({
            _id: new ObjectId(req.params.requestId), type: 'channel', status: 'pending',
        });

        if (!request) {
            return res.status(404).json({message: 'Pending channel request not found'});
        }

        const groupFound = await getDB().collection('groups').findOne({title: request.groupTitle});
        if (!groupFound) {
            return res.status(404).json({message: 'Group not found'});
        }

        const groupAdmin = req.user.role !== 'superAdmin' && groupFound.admins.includes(req.user.username)
            ? req.user.username : null;
        if (!groupAdmin) {
            return res.status(403).json({message: 'Only this group\'s admins can review the request'});
        }

        if (action === 'approve') {
            const channelExists = await getDB().collection('channels').findOne(
                {name: request.name, groupTitle: request.groupTitle}, {collation: {locale: 'en', strength: 2}}
            );
            if (channelExists) {
                return res.status(400).json({message: 'Channel already exists in this group'});
            }
            const requester = await getDB().collection('users').findOne({username: request.requestedBy});
            const age = requester?.dateOfBirth ? calculateAge(requester.dateOfBirth) : requester?.age;
            if (!requester || requester.role === 'superAdmin' || !groupFound.members.includes(requester.username) ||
                !Number.isFinite(age) || age < groupFound.minimumAge || (groupFound.bannedMembers || []).includes(requester.username)) {
                return res.status(400).json({message: 'Requesting user no longer meets the group requirements'});
            }

            await getDB().collection('channels').insertOne({
                name: request.name,
                groupTitle: request.groupTitle,
                createdBy: request.requestedBy,
            });
        }

        await getDB().collection('requests').updateOne(
            { _id: request._id },
            {
                $set: {
                    status: action === 'approve' ? 'approved' : 'rejected',
                    reviewedBy: groupAdmin,
                    reviewedAt: new Date().toISOString(),
                },
            }
        );

        await recordAudit(req.user.username, `channel request ${action}`, `${request.groupTitle}/#${request.name}`);
        return res.status(200).json({
            message: action === 'approve' ? 'Channel request approved' : 'Channel request rejected'
        });
    } catch (error) {
        console.error('Error reviewing channel request:', error);
        return res.status(500).json({message: 'Failed to review channel request'});
    }
});

app.get('/api/channels', async (req, res) => {
    try {
        const age = req.user.dateOfBirth ? calculateAge(req.user.dateOfBirth) : req.user.age;
        const filter = req.user.role === 'superAdmin' ? {} : {
            members: req.user.username, bannedMembers: {$ne: req.user.username}, minimumAge: {$lte: age},
        };
        const groups = await getDB().collection('groups').find(filter).project({title: 1}).toArray();
        const channels = await getDB().collection('channels').find({groupTitle: {$in: groups.map(group => group.title)}}).toArray();
        return res.status(200).json(channels);
    } catch (error) {
        console.error('Error loading channels:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
});

addAdminRoutes(app, io);

async function startServer() {
    try {
        await connectDB();

        httpServer.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error('Unable to start Fabulari:', error);
        process.exitCode = 1;
    }
}

startServer();
