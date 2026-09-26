import express from 'express';
import cors from 'cors';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import 'dotenv/config';
import { checkDatabaseHealth, connectDB } from './db.js';

const app = express();
const port = Number(process.env.HTTP_PORT) || 3000;


app.use(cors());
app.use(express.json());

app.post('/api/users', (req, res) => {
    const newUser = req.body;
    if (!newUser.username ||
         !newUser.firstName ||
          !newUser.lastName ||
           !newUser.email ||
             newUser.age === null ||
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
                            age: users[i].age,
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


app.post('/api/groups', (req, res) => {
    const newGroup = req.body;

    if(
        !newGroup.title ||
        !newGroup.description ||
        newGroup.minimumAge === null || newGroup.minimumAge === undefined ||
        !newGroup.admin
    ){
        return res.status(400).json({message: 'All fields are mandatory!'});
    }

    fs.readFile('./server/data/groups.json', 'utf8', (err, data) => {
        if(err){
            console.error('Error reading groups.json:', err);
            return res.status(500).json({message: 'Internal server error'});
        }

        const groups = JSON.parse(data);
        newGroup.title = newGroup.title.trim();
        newGroup.description = newGroup.description.trim();
        newGroup.admin = newGroup.admin.trim();

        if(
        !newGroup.title ||
        !newGroup.description ||
        !newGroup.admin
        ){
            return res.status(400).json({message: 'All fields are mandatory!'});
        };
        
        if(newGroup.title.length > 30) {
            return res.status(400).json({message: 'Group title cannot exceed 30 characters'});
        };
        
        if(newGroup.description.length > 250) {
            return res.status(400).json({message: 'Group description cannot exceed 250 characters'});
        };
        
        for (let i = 0; i < groups.length; i++){
            if (groups[i].title.toLowerCase() === newGroup.title.toLowerCase())
                {return res.status(400).json({message: 'Group title already exists'});
            }
        };

        fs.readFile('./server/data/users.json', 'utf8', (err, userData) => {
            if (err) {
                console.error('Error reading users.json:', err);
                return res.status(500).json({message: 'Internal server error'});
            };
            
            const users = JSON.parse(userData);
            let adminExists = false;
            for (let i = 0; i < users.length; i++) {
                if (
                users[i].username.toLowerCase() === newGroup.admin.toLowerCase())
                {adminExists = true;
                    if (users[i].role === 'superAdmin') {
                        return res.status(400).json({message: 'Cannot assign Super Admin as Group Admin'});
                    }
                    
                    users[i].role = 'groupAdmin';
                    newGroup.admin = users[i].username;
                    break;
                }
            };
            if (!adminExists) {
                return res.status(400).json({message: 'Admin username does not exist'});
            }
            
            const updatedUsers = JSON.stringify(users, null, 2);
            fs.writeFile('./server/data/users.json', updatedUsers,'utf8', (err) => {
                if (err) {
                    console.error('Error writing to users.json:', err);
                    return res.status(500).json({message: 'Failed to update user data'});
                };

                newGroup.members = [newGroup.admin];
                newGroup.joinRequests = [];
                groups.push(newGroup);                
            
                const updatedData = JSON.stringify(groups, null, 2);
                
                fs.writeFile('./server/data/groups.json', updatedData, 'utf8', (err) => {
                    if (err) {
                        console.error('Error writing to groups.json:', err);
                        return res.status(500).json({message: 'Failed to save group data'});
                    }

                    return res.status(201).json({message: 'Group created successfully'});
                });
            });
        });
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

            if(userFound.age < groupFound.minimumAge){
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

        if(groupFound.admin.toLowerCase() !== newChannel.createdBy.toLowerCase()){
            return res.status(400).json({message: 'Only the Group Admin can create rooms'});
        }

        newChannel.groupTitle = groupFound.title;
        newChannel.createdBy = groupFound.admin;

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
