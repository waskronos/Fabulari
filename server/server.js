import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { checkDatabaseHealth, connectDB, getDB, seedDatabase } from './db.js';
import connectSockets from './sockets.js';

const app = express();
const port = Number(process.env.HTTP_PORT) || 3000;
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: 'http://localhost:4200',
        methods: ['GET', 'POST'],
    },
});

connectSockets(io);

function calculateAge(dateOfBirth) {
    const today = new Date();
    const birthDate = new Date(`${dateOfBirth}T00:00:00`);
    let age = today.getFullYear() - birthDate.getFullYear();
    const birthdayHasPassed =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() >= birthDate.getDate());

    if (!birthdayHasPassed) {
        age--;
    }

    return age;
}

app.use(cors());
app.use(express.json());

app.post('/api/users', async (req, res) => {
    const newUser = req.body;
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
        const users = await getDB().collection('users').find().toArray();
        newUser.email = newUser.email.trim().toLowerCase();
        newUser.username = newUser.username.trim();
        newUser.firstName = newUser.firstName.trim();
        newUser.lastName = newUser.lastName.trim();

        if (!newUser.username ||
         !newUser.firstName ||
          !newUser.lastName ||
           !newUser.email){
            return res.status(400).json({message: 'All fields are mandatory!'})};

        const emailExists = users.some(user => user.email === newUser.email);
        const usernameExists = users.some(
            user => user.username.toLowerCase() === newUser.username.toLowerCase()
        );

        if(emailExists){
            return res.status(400).json({message: 'Email already exists'});
        }
        if(usernameExists){
            return res.status(400).json({message: 'Username already exists'});
        }

        if (users.length === 0)
            { newUser.role = 'superAdmin';
             } else{
                newUser.role = 'user';
             };
             
             
             const hashedPassword = await bcrypt.hash(newUser.password, 10);
             newUser.password = hashedPassword;
             
             await getDB().collection('users').insertOne(newUser);
             return res.json({message: 'User added successfully'});
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({message: 'Failed to save user data'});
    }
});

app.post('/api/login', async (req, res) => {
    const loginData = req.body;

    if (!loginData.username || !loginData.password) {
        return res.status(400).json({ message: 'Please fill both fields' });
    }

    try {
        const users = await getDB().collection('users').find().toArray();
        const user = users.find(
            item => item.username.toLowerCase() === loginData.username.toLowerCase()
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
            },
        });
    } catch (error) {
        console.error('Error logging in:', error);
        return res.status(500).json({ message: 'Internal server error' });
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
        const [users, groups, requests] = await Promise.all([
            getDB().collection('users').find().toArray(),
            getDB().collection('groups').find().toArray(),
            getDB().collection('requests').find().toArray(),
        ]);
        const requester = users.find(
            user => user.username.toLowerCase() === requestedBy.trim().toLowerCase()
        );

        if (!requester) {
            return res.status(404).json({message: 'User not found'});
        }
        if (requester.role === 'superAdmin') {
            return res.status(400).json({message: 'Super Admin cannot request a group'});
        }
        if (groups.some(group => group.title.toLowerCase() === cleanTitle.toLowerCase())) {
            return res.status(400).json({message: 'Group title already exists'});
        }

        const duplicateRequest = requests.some(request =>
            request.type === 'group' &&
            request.status === 'pending' &&
            request.title.toLowerCase() === cleanTitle.toLowerCase()
        );
        if (duplicateRequest) {
            return res.status(400).json({message: 'A request for this group title is already pending'});
        }

        await getDB().collection('requests').insertOne({
            id: randomUUID(),
            type: 'group',
            title: cleanTitle,
            description: cleanDescription,
            minimumAge: numericMinimumAge,
            requestedBy: requester.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });

        return res.status(201).json({message: 'Group request sent to the Super Admin'});
    } catch (error) {
        console.error('Error creating group request:', error);
        return res.status(500).json({message: 'Failed to save group request'});
    }
});

app.get('/api/group-requests', async (req, res) => {
    const username = String(req.query.username ?? '').trim();

    try {
        const [users, requests] = await Promise.all([
            getDB().collection('users').find().toArray(),
            getDB().collection('requests').find().toArray(),
        ]);
        const currentUser = users.find(
            user => user.username.toLowerCase() === username.toLowerCase()
        );

        if (!currentUser || currentUser.role !== 'superAdmin') {
            return res.status(403).json({message: 'Only the Super Admin can view group requests'});
        }

        return res.status(200).json(
            requests.filter(request => request.type === 'group' && request.status === 'pending')
        );
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
        const [users, groups, requests] = await Promise.all([
            getDB().collection('users').find().toArray(),
            getDB().collection('groups').find().toArray(),
            getDB().collection('requests').find().toArray(),
        ]);
        const reviewer = users.find(
            user => user.username.toLowerCase() === String(reviewedBy ?? '').trim().toLowerCase()
        );

        if (!reviewer || reviewer.role !== 'superAdmin') {
            return res.status(403).json({message: 'Only the Super Admin can review group requests'});
        }

        const request = requests.find(item => item.id === req.params.requestId);
        if (!request || request.type !== 'group' || request.status !== 'pending') {
            return res.status(404).json({message: 'Pending group request not found'});
        }

        if (action === 'approve') {
            if (groups.some(group => group.title.toLowerCase() === request.title.toLowerCase())) {
                return res.status(400).json({message: 'Group title already exists'});
            }

            const requester = users.find(user => user.username === request.requestedBy);
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
            });
        }

        await getDB().collection('requests').updateOne(
            { id: request.id },
            {
                $set: {
                    status: action === 'approve' ? 'approved' : 'rejected',
                    reviewedBy: reviewer.username,
                    reviewedAt: new Date().toISOString(),
                },
            }
        );

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
    if(!joinData.title || !joinData.username) {
        return res.status(400).json({message: 'Group title and username are required'});
    }  

    try {
        const [users, groups] = await Promise.all([
            getDB().collection('users').find().toArray(),
            getDB().collection('groups').find().toArray(),
        ]);
        const userFound = users.find(
            user => user.username.toLowerCase() === joinData.username.toLowerCase()
        );
        if(!userFound) {
            return res.status(404).json({message: 'User not found'});
        }

        const groupFound = groups.find(
            group => group.title.toLowerCase() === joinData.title.toLowerCase()
        );
        if(!groupFound) {
                return res.status(404).json({message: 'Group not found'});
        }

        const userAge = userFound.dateOfBirth
            ? calculateAge(userFound.dateOfBirth)
            : userFound.age;

        if(userAge < groupFound.minimumAge){
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
            { $push: { joinRequests: userFound.username } }
        );
        return res.status(200).json({message: 'Join request sent successfully'});
    } catch (error) {
        console.error('Error requesting group membership:', error);
        return res.status(500).json({message: 'Failed to update group data'});
    }
});


app.post('/api/groups/approve', async (req, res) => {
    const approvalData = req.body;

    if(!approvalData.title || !approvalData.username){
        return res.status(400).json({message: 'Group title and username are required'});
    }

    try {
        const groups = await getDB().collection('groups').find().toArray();
        const groupFound = groups.find(
            group => group.title.toLowerCase() === approvalData.title.toLowerCase()
        );

        if(!groupFound){
            return res.status(404).json({message: 'Group not found'});
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
        const [groups, channels] = await Promise.all([
            getDB().collection('groups').find().toArray(),
            getDB().collection('channels').find().toArray(),
        ]);
        const groupFound = groups.find(
            group => group.title.toLowerCase() === groupTitle.trim().toLowerCase()
        );

        if (!groupFound) {
            return res.status(404).json({message: 'Group not found'});
        }

        const groupAdmin = groupFound.admins.find(
            admin => admin.toLowerCase() === createdBy.trim().toLowerCase()
        );
        if (!groupAdmin) {
            return res.status(403).json({message: 'Only this group\'s admins can create channels'});
        }

        const cleanName = name.trim();
        const channelExists = channels.some(channel =>
            channel.name.toLowerCase() === cleanName.toLowerCase() &&
            channel.groupTitle.toLowerCase() === groupFound.title.toLowerCase()
        );
        if (channelExists) {
            return res.status(400).json({message: 'Channel already exists in this group'});
        }

        await getDB().collection('channels').insertOne({
            name: cleanName,
            groupTitle: groupFound.title,
            createdBy: groupAdmin,
        });

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
        const [users, groups, channels, requests] = await Promise.all([
            getDB().collection('users').find().toArray(),
            getDB().collection('groups').find().toArray(),
            getDB().collection('channels').find().toArray(),
            getDB().collection('requests').find().toArray(),
        ]);
        const requester = users.find(
            user => user.username.toLowerCase() === requestedBy.trim().toLowerCase()
        );
        const groupFound = groups.find(
            group => group.title.toLowerCase() === groupTitle.trim().toLowerCase()
        );

        if (!requester) {
            return res.status(404).json({message: 'User not found'});
        }
        if (!groupFound) {
            return res.status(404).json({message: 'Group not found'});
        }
        if (!groupFound.members.includes(requester.username)) {
            return res.status(403).json({message: 'Only group members can request channels'});
        }

        const cleanName = name.trim();
        const channelExists = channels.some(channel =>
            channel.name.toLowerCase() === cleanName.toLowerCase() &&
            channel.groupTitle.toLowerCase() === groupFound.title.toLowerCase()
        );
        if (channelExists) {
            return res.status(400).json({message: 'Channel already exists in this group'});
        }

        const duplicateRequest = requests.some(request =>
            request.type === 'channel' &&
            request.status === 'pending' &&
            request.name.toLowerCase() === cleanName.toLowerCase() &&
            request.groupTitle.toLowerCase() === groupFound.title.toLowerCase()
        );
        if (duplicateRequest) {
            return res.status(400).json({message: 'This channel request is already pending'});
        }

        await getDB().collection('requests').insertOne({
            id: randomUUID(),
            type: 'channel',
            groupTitle: groupFound.title,
            name: cleanName,
            requestedBy: requester.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });

        return res.status(201).json({message: 'Channel request sent to the Group Admin'});
    } catch (error) {
        console.error('Error creating channel request:', error);
        return res.status(500).json({message: 'Failed to save channel request'});
    }
});

app.get('/api/channel-requests', async (req, res) => {
    const username = String(req.query.username ?? '').trim().toLowerCase();

    try {
        const [groups, requests] = await Promise.all([
            getDB().collection('groups').find().toArray(),
            getDB().collection('requests').find().toArray(),
        ]);
        const adminGroupTitles = groups
            .filter(group => group.admins.some(admin => admin.toLowerCase() === username))
            .map(group => group.title.toLowerCase());

        const pendingRequests = requests.filter(request =>
            request.type === 'channel' &&
            request.status === 'pending' &&
            adminGroupTitles.includes(request.groupTitle.toLowerCase())
        );

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
        const [groups, channels, requests] = await Promise.all([
            getDB().collection('groups').find().toArray(),
            getDB().collection('channels').find().toArray(),
            getDB().collection('requests').find().toArray(),
        ]);
        const request = requests.find(item =>
            item.id === req.params.requestId &&
            item.type === 'channel' &&
            item.status === 'pending'
        );

        if (!request) {
            return res.status(404).json({message: 'Pending channel request not found'});
        }

        const groupFound = groups.find(group => group.title === request.groupTitle);
        if (!groupFound) {
            return res.status(404).json({message: 'Group not found'});
        }

        const groupAdmin = groupFound.admins.find(
            admin => admin.toLowerCase() === String(reviewedBy ?? '').trim().toLowerCase()
        );
        if (!groupAdmin) {
            return res.status(403).json({message: 'Only this group\'s admins can review the request'});
        }

        if (action === 'approve') {
            const channelExists = channels.some(channel =>
                channel.name.toLowerCase() === request.name.toLowerCase() &&
                channel.groupTitle.toLowerCase() === request.groupTitle.toLowerCase()
            );
            if (channelExists) {
                return res.status(400).json({message: 'Channel already exists in this group'});
            }

            await getDB().collection('channels').insertOne({
                name: request.name,
                groupTitle: request.groupTitle,
                createdBy: request.requestedBy,
            });
        }

        await getDB().collection('requests').updateOne(
            { id: request.id },
            {
                $set: {
                    status: action === 'approve' ? 'approved' : 'rejected',
                    reviewedBy: groupAdmin,
                    reviewedAt: new Date().toISOString(),
                },
            }
        );

        return res.status(200).json({
            message: action === 'approve' ? 'Channel request approved' : 'Channel request rejected'
        });
    } catch (error) {
        console.error('Error reviewing channel request:', error);
        return res.status(500).json({message: 'Failed to review channel request'});
    }
});

app.get('/api/channels', async (_req, res) => {
    try {
        const channels = await getDB().collection('channels').find().toArray();
        return res.status(200).json(channels);
    } catch (error) {
        console.error('Error loading channels:', error);
        return res.status(500).json({message: 'Internal server error'});
    }
});

app.get('/api/health', async (_req, res) => {
    try {
        await checkDatabaseHealth();
        return res.status(200).json({server: 'ok', database: 'ok'});
    } catch (error) {
        console.error('Database health check failed:', error);
        return res.status(503).json({server: 'ok', database: 'unavailable'});
    }
});

async function startServer() {
    try {
        await connectDB();
        await checkDatabaseHealth();
        await seedDatabase();

        httpServer.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error('Unable to start Fabulari:', error);
        process.exitCode = 1;
    }
}

startServer();
