import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { checkDatabaseHealth, connectDB } from './db.js';

const app = express();
const port = Number(process.env.HTTP_PORT) || 3000;

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

app.post('/api/users', (req, res) => {
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

    fs.readFile('./server/data/users.json', 'utf8', async (err, data) => {
        if(err){
            console.error('Error reading users.json:', err);
            return;
        }

        const users = JSON.parse(data);

        let emailExists = false;
        let usernameExists = false;
        newUser.email = newUser.email.trim().toLowerCase();
        newUser.username = newUser.username.trim();
        newUser.firstName = newUser.firstName.trim();
        newUser.lastName = newUser.lastName.trim();

        if (!newUser.username ||
         !newUser.firstName ||
          !newUser.lastName ||
           !newUser.email){
            return res.status(400).json({message: 'All fields are mandatory!'})};

        for(let i = 0; i < users.length; i++){
            if(users[i].email === newUser.email){
                emailExists = true;
            }
            if(users[i].username.toLowerCase() === newUser.username.toLowerCase()){
                usernameExists = true;
            }

            if(emailExists){
                return res.status(400).json({message: 'Email already exists'});
            }
            if(usernameExists){
                return res.status(400).json({message: 'Username already exists'});
            }
        }

        if (users.length === 0)
            { newUser.role = 'superAdmin';
             } else{
                newUser.role = 'user';
             };
             
             
             const hashedPassword = await bcrypt.hash(newUser.password, 10);
             newUser.password = hashedPassword;
             
             users.push(newUser);

             const updatedData = JSON.stringify(users, null, 2);
             
             fs.writeFile('./server/data/users.json', updatedData, 'utf8', (err) => {
                if(err){
                console.error('Error writing to users.json:', err);
                return res.status(500).json({message: 'Failed to save user data'});}
                
                console.log('User added successfully');
                res.json({
                message: 'User added successfully'
            });
        });
    });
});

fs.readFile('./server/data/users.json', 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading users.json:', err);
        return;
    }
});

app.post('/api/login', (req, res) => {
    const loginData = req.body;

    if (!loginData.username || !loginData.password) {
        return res.status(400).json({ message: 'Please fill both fields' });
    }

    fs.readFile('./server/data/users.json', 'utf8', async (err, data) => {
        if (err) {
            console.error('Error reading users.json:', err);
            return res.status(500).json({ message: 'Internal server error' });
        }

        const users = JSON.parse(data);
        for(let i = 0; i < users.length; i++){
            if(users[i].username.toLowerCase() === loginData.username.toLowerCase()){
                const passwordMatch = await bcrypt.compare(loginData.password, users[i].password);
                if (passwordMatch) {
                    return res.json({ message: 'Login successful' ,
                        user: {
                            username: users[i].username,
                            firstName: users[i].firstName,
                            lastName: users[i].lastName,
                            email: users[i].email,
                            dateOfBirth: users[i].dateOfBirth,
                            age: users[i].dateOfBirth
                                ? calculateAge(users[i].dateOfBirth)
                                : users[i].age,
                            role: users[i].role }
                });
                }
                else {
                    return res.status(401).json({ message: 'Invalid credentials' });
                }
            }
        }
            return res.status(401).json({ message: 'Invalid credentials' });
    });
});


app.get('/api/groups', (req, res) => {
    fs.readFile('./server/data/groups.json', 'utf8', (err, data) => {
        if(err){
            console.error('Error reading groups.json:', err);
            return res.status(500).json({message: 'Internal server error'});
        }
        const groups = JSON.parse(data);
        return res.status(200).json(groups);
    });
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
            readJsonFile('./server/data/users.json'),
            readJsonFile('./server/data/groups.json'),
            readJsonFile('./server/data/requests.json'),
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

        requests.push({
            id: randomUUID(),
            type: 'group',
            title: cleanTitle,
            description: cleanDescription,
            minimumAge: numericMinimumAge,
            requestedBy: requester.username,
            status: 'pending',
            createdAt: new Date().toISOString(),
        });

        await writeJsonFile('./server/data/requests.json', requests);
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
            readJsonFile('./server/data/users.json'),
            readJsonFile('./server/data/requests.json'),
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
            readJsonFile('./server/data/users.json'),
            readJsonFile('./server/data/groups.json'),
            readJsonFile('./server/data/requests.json'),
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

            groups.push({
                title: request.title,
                description: request.description,
                minimumAge: request.minimumAge,
                admins: [requester.username],
                members: [requester.username],
                joinRequests: [],
            });

            await writeJsonFile('./server/data/groups.json', groups);
        }

        request.status = action === 'approve' ? 'approved' : 'rejected';
        request.reviewedBy = reviewer.username;
        request.reviewedAt = new Date().toISOString();
        await writeJsonFile('./server/data/requests.json', requests);

        return res.status(200).json({
            message: action === 'approve' ? 'Group request approved' : 'Group request rejected'
        });
    } catch (error) {
        console.error('Error reviewing group request:', error);
        return res.status(500).json({message: 'Failed to review group request'});
    }
});

app.post('/api/groups/join', (req, res) => {
    const joinData = req.body;
    if(!joinData.title || !joinData.username) {
        return res.status(400).json({message: 'Group title and username are required'});
    }  

    fs.readFile('./server/data/users.json', 'utf8', (err, data) => {
        if(err){
            console.error('Error reading user.json:', err);
            return res.status(500).json({message: 'Internal server error'});
        }

        const users = JSON.parse(data);
        let userFound = null;
        for(let i = 0; i < users.length; i++){
            if(users[i].username.toLowerCase() === joinData.username.toLowerCase()){
                userFound = users[i];
                break;
            }
        } if(!userFound) {
            return res.status(404).json({message: 'User not found'});
        }

        fs.readFile('./server/data/groups.json', 'utf8', (err, data) => {
            if(err){
                console.error('Error reading groups.json:', err);
                return res.status(500).json({message: 'Internal server error'});
            }

            const groups = JSON.parse(data);
            let groupFound = null;
            for (let i = 0; i < groups.length; i++){
                if(groups[i].title.toLowerCase() === joinData.title.toLowerCase()){
                    groupFound = groups[i];
                    break;
                }
            } if(!groupFound) {
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
            
            groupFound.joinRequests.push(userFound.username);

            const updatedGroupsData = JSON.stringify(groups, null, 2);

            fs.writeFile('./server/data/groups.json', updatedGroupsData, 'utf8', (err) => {
                if(err){
                    console.error('Error writing to groups.json:', err);
                    return res.status(500).json({message: 'Failed to update group data'});
                }

                return res.status(200).json({message: 'Join request sent successfully'});
            });
        });
    });
});


app.post('/api/groups/approve', (req, res) => {
    const approvalData = req.body;

    if(!approvalData.title || !approvalData.username){
        return res.status(400).json({message: 'Group title and username are required'});
    }

    fs.readFile('./server/data/groups.json', 'utf8', (err, data) => {
        if(err){
            console.error('Error reading groups.json:', err);
            return res.status(500).json({message: 'Internal server error'});
        }

        const groups = JSON.parse(data);
        let groupFound = null;

        for(let i = 0; i < groups.length; i++){
            if(groups[i].title.toLowerCase() === approvalData.title.toLowerCase()){
                groupFound = groups[i];
                break;
            }
        }

        if(!groupFound){
            return res.status(404).json({message: 'Group not found'});
        }

        const requestIndex = groupFound.joinRequests.indexOf(approvalData.username);

        if(requestIndex === -1){
            return res.status(400).json({message: 'No join request from this user'});
        }

        groupFound.joinRequests.splice(requestIndex, 1);
        groupFound.members.push(approvalData.username);

        const updatedGroupsData = JSON.stringify(groups, null, 2);

        fs.writeFile('./server/data/groups.json', updatedGroupsData, 'utf8', (err) => {
            if(err){
                console.error('Error writing to groups.json:', err);
                return res.status(500).json({message: 'Failed to update group data'});
            }

            return res.status(200).json({message: 'User added to group successfully'});
        });
    });
});

app.post('/api/channels', (req, res) => {
    const newChannel = req.body;

    if(!newChannel.name ||
       !newChannel.groupTitle ||
       newChannel.minimumAge === null ||
       newChannel.minimumAge === undefined ||
       !newChannel.createdBy){
        return res.status(400).json({message: 'All fields are mandatory!'});
    }

    newChannel.name = newChannel.name.trim();
    newChannel.groupTitle = newChannel.groupTitle.trim();
    newChannel.createdBy = newChannel.createdBy.trim();

    if(!newChannel.name || !newChannel.groupTitle || !newChannel.createdBy){
        return res.status(400).json({message: 'All fields are mandatory!'});
    }

    fs.readFile('./server/data/groups.json', 'utf8', (err, data) => {
        if(err){
            console.error('Error reading groups.json:', err);
            return res.status(500).json({message: 'Internal server error'});
        }

        const groups = JSON.parse(data);
        let groupFound = null;

        for(let i = 0; i < groups.length; i++){
            if(groups[i].title.toLowerCase() === newChannel.groupTitle.toLowerCase()){
                groupFound = groups[i];
                break;
            }
        }

        if(!groupFound){
            return res.status(404).json({message: 'Group not found'});
        }

        const groupAdmin = groupFound.admins.find(
            admin => admin.toLowerCase() === newChannel.createdBy.toLowerCase()
        );

        if(!groupAdmin){
            return res.status(400).json({message: 'Only the Group Admin can create rooms'});
        }

        newChannel.groupTitle = groupFound.title;
        newChannel.createdBy = groupAdmin;

        fs.readFile('./server/data/channels.json', 'utf8', (err, data) => {
            if(err){
                console.error('Error reading channels.json:', err);
                return res.status(500).json({message: 'Internal server error'});
            }

            const channels = JSON.parse(data);

            for(let i = 0; i < channels.length; i++){
                if(channels[i].name.toLowerCase() === newChannel.name.toLowerCase() &&
                   channels[i].groupTitle.toLowerCase() === newChannel.groupTitle.toLowerCase()){
                    return res.status(400).json({message: 'Room already exists in this group'});
                }
            }

            channels.push(newChannel);

            const updatedData = JSON.stringify(channels, null, 2);

            fs.writeFile('./server/data/channels.json', updatedData, 'utf8', (err) => {
                if(err){
                    console.error('Error writing to channels.json:', err);
                    return res.status(500).json({message: 'Failed to save room data'});
                }

                return res.status(201).json({message: 'Room created successfully'});
            });
        });
    });
});


app.get('/api/channels', (req, res) => {
    fs.readFile('./server/data/channels.json', 'utf8', (err, data) => {
        if(err){
            console.error('Error reading channels.json:', err);
            return res.status(500).json({message: 'Internal server error'});
        }

        const channels = JSON.parse(data);
        return res.status(200).json(channels);
    });
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

async function readJsonFile(path) {
    const data = await fsPromises.readFile(path, 'utf8');
    return JSON.parse(data);
}

async function writeJsonFile(path, value) {
    await fsPromises.writeFile(path, JSON.stringify(value, null, 2), 'utf8');
}

async function startServer() {
    try {
        await connectDB();
        await checkDatabaseHealth();

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    } catch (error) {
        console.error('Unable to start Fabulari:', error);
        process.exitCode = 1;
    }
}

startServer();
