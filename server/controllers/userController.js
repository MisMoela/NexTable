const pool = require('../db/connection');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Enums as constants (match schema)
const USER_ROLES = ['customer', 'waiter', 'chef', 'admin'];

exports.register = async (req, res) => {
  try {
    const { email, password, first_name, last_name, role = 'customer' } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Allowed: ${USER_ROLES.join(', ')}` });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING user_id, email, role, first_name, last_name`,
      [email, hashedPassword, first_name || null, last_name || null, role]
    );

    const token = jwt.sign(
      { userId: result.rows[0].user_id, role: result.rows[0].role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already exists' });
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const result = await pool.query(
      'SELECT user_id, email, password_hash, role, first_name, last_name FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.user_id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { user_id: user.user_id, email: user.email, role: user.role, first_name: user.first_name, last_name: user.last_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProfile = async (req, res) => {
  res.json(req.user);
};

exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name } = req.body;
    const userId = req.user.userId;
    const role = req.user.role;

    if (parseInt(id) !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Can only update self or as admin' });
    }

    if (!first_name && !last_name) {
      return res.status(400).json({ error: 'At least one name field required' });
    }

    const result = await pool.query(
      `UPDATE users 
       SET first_name = $1, last_name = $2, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $3
       RETURNING user_id, email, role, first_name, last_name`,
      [first_name || null, last_name || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const role = req.user.role;

    if (parseInt(id) !== userId && role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Can only delete self or as admin' });
    }

    const result = await pool.query(
      'DELETE FROM users WHERE user_id = $1 RETURNING user_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};