const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });  // Or '../.env' if in root
const userRoutes = require('./routes/userRoutes');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));  // For Vite frontend
app.use(express.json());

app.use('/api/users', userRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));