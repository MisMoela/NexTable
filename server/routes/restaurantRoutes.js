const express = require('express');
const { getAllRestaurants, getRestaurantById, createRestaurant, updateRestaurant, deleteRestaurant } = require('../controllers/restaurantController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, getAllRestaurants);
router.get('/:id', authMiddleware, getRestaurantById);
router.post('/', authMiddleware, createRestaurant);
router.put('/:id', authMiddleware, updateRestaurant);
router.delete('/:id', authMiddleware, deleteRestaurant);

module.exports = router;