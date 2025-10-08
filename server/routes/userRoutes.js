const express = require('express');
const { register, login, getProfile, updateUser, deleteUser } = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authMiddleware, getProfile);
router.put('/:id', authMiddleware, updateUser);
router.delete('/:id', authMiddleware, deleteUser);

module.exports = router;