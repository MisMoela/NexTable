const pool = require('../db/connection');

// Enums (match schema)
const ASSIGNMENT_ROLES = ['owner', 'manager', 'waiter', 'chef', 'customer'];

exports.getAllRestaurants = async (req, res) => {
  try {
    const userId = req.user.userId;  // From auth middleware

    const result = await pool.query(
      `SELECT r.restaurant_id, r.name, r.address, r.phone, r.description, r.created_at
       FROM restaurants r
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE ur.user_id = $1 AND ur.is_active = true
       ORDER BY r.created_at DESC`,
      [userId]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT r.*, ur.assignment_role
       FROM restaurants r
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE r.restaurant_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const { name, address, phone, description } = req.body;
    const userId = req.user.userId;
    const role = req.user.role;

    if (!name) return res.status(400).json({ error: 'Name required' });

    // Start transaction for atomicity (create restaurant + assign owner)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert restaurant
      const restaurantResult = await client.query(
        `INSERT INTO restaurants (name, address, phone, description, owner_user_id) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING restaurant_id`,
        [name, address || null, phone || null, description || null, userId]
      );

      const restaurantId = restaurantResult.rows[0].restaurant_id;

      // Auto-assign creator as 'owner'
      await client.query(
        `INSERT INTO user_restaurants (user_id, restaurant_id, assignment_role) 
         VALUES ($1, $2, 'owner')`,
        [userId, restaurantId]
      );

      await client.query('COMMIT');

      // Fetch full restaurant for response
      const fullResult = await pool.query(
        `SELECT r.*, ur.assignment_role
         FROM restaurants r
         JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
         WHERE r.restaurant_id = $1 AND ur.user_id = $2`,
        [restaurantId, userId]
      );

      res.status(201).json(fullResult.rows[0]);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, description } = req.body;
    const userId = req.user.userId;

    if (!name && !address && !phone && !description) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    // Check assignment (owner/manager only)
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, id]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only' });
    }

    const result = await pool.query(
      `UPDATE restaurants 
       SET name = $1, address = $2, phone = $3, description = $4, updated_at = CURRENT_TIMESTAMP
       WHERE restaurant_id = $5
       RETURNING restaurant_id, name, address, phone, description`,
      [name || null, address || null, phone || null, description || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check assignment (owner only)
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, id]
    );

    if (accessResult.rows.length === 0 || accessResult.rows[0].assignment_role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized: Owner only' });
    }

    // Delete (cascades to tables/orders via ON DELETE CASCADE in schema)
    const result = await pool.query(
      `DELETE FROM restaurants WHERE restaurant_id = $1 RETURNING restaurant_id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    res.json({ message: 'Restaurant deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};