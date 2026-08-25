import express from 'express';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/users', (req, res) => {
    console.log('Received user registration data:', req.body);


res.json({ message: 'User registered successfully' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});