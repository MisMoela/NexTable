const express = require('express');
const cors = require('cors');
require('dotenv').config({ path: '../.env' });  

const userRoutes = require('./routes/userRoutes');
const restaurantRoutes = require('./routes/restaurantRoutes');
const tableRoutes = require('./routes/tableRoutes');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));  // For Vite frontend
app.use(express.json());

app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/tables', tableRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));