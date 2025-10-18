const express = require('express');
const { getAllTables, getTableById, createTable, updateTable, deleteTable, getTablesByRestaurant } = require('../controllers/tableController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, getAllTables);
router.get('/:id', authMiddleware, getTableById);
router.get('/restaurant/:restaurantId', authMiddleware, getTablesByRestaurant);  
router.post('/', authMiddleware, createTable);
router.put('/:id', authMiddleware, updateTable);
router.delete('/:id', authMiddleware, deleteTable);

module.exports = router;