const express = require('express');
const { getAllOrders, getOrderById, getOrdersByTable, createOrder, updateOrder, deleteOrder } = require('../controllers/ordersController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/:restaurantId', authMiddleware, getAllOrders);  
router.post('/:restaurantId', authMiddleware, createOrder);  
router.get('/:restaurantId/:id', authMiddleware, getOrderById); 
router.put('/:restaurantId/:id', authMiddleware, updateOrder);  
router.get('/:restaurantId/tables/:tableId', authMiddleware, getOrdersByTable);
router.delete('/:restaurantId/:id', authMiddleware, deleteOrder); 

module.exports = router;