const express = require('express');
const { getAllMenuItems, getMenuItemById, createMenuItem, updateMenuItem, deleteMenuItem } = require('../controllers/menuController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/:restaurantId', authMiddleware, getAllMenuItems);
router.get('/:restaurantId/:id', authMiddleware, getMenuItemById);
router.post('/:restaurantId', authMiddleware, createMenuItem);
router.put('/:restaurantId/:id', authMiddleware, updateMenuItem);
router.delete('/:restaurantId/:id', authMiddleware, deleteMenuItem);

module.exports = router;