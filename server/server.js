import express from 'express';
import cors from 'cors';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const app = express();
const port = 3000;


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
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});