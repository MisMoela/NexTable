const pool = require('../db/connection');

// Enums (match schema)
const TABLE_STATUSES = ['available', 'occupied', 'reserved', 'maintenance'];

exports.getAllTables = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { restaurantId } = req.query;  // Optional: Filter by restaurant

    let query = `
      SELECT t.table_id, t.restaurant_id, t.number, t.status, t.capacity, t.location, t.notes, t.created_at
      FROM restaurant_tables t
      JOIN restaurants r ON t.restaurant_id = r.restaurant_id
      JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
      WHERE ur.user_id = $1 AND ur.is_active = true
    `;
    let params = [userId];

    if (restaurantId) {
      query += ` AND t.restaurant_id = $${params.length + 1}`;
      params.push(restaurantId);
    }

    query += ` ORDER BY t.number`;
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTablesByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;  // From URL path: /api/tables/restaurant/:restaurantId
    const userId = req.user.userId;

    if (!restaurantId) {
      return res.status(400).json({ error: 'restaurantId required' });
    }

    // Check access to the restaurant
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurantId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager', 'waiter', 'chef', 'customer'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Access to this restaurant denied' });
    }

    const result = await pool.query(
      `SELECT t.table_id, t.restaurant_id, t.number, t.status, t.capacity, t.location, t.notes, t.created_at
       FROM restaurant_tables t
       WHERE t.restaurant_id = $1
       ORDER BY t.number`,
      [restaurantId]
    );

    res.json({
      restaurant_id: parseInt(restaurantId),
      tables: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getTableById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT t.*, r.name as restaurant_name
       FROM restaurant_tables t
       JOIN restaurants r ON t.restaurant_id = r.restaurant_id
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE t.table_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found or access denied' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createTable = async (req, res) => {
  try {
    const { restaurant_id, number, capacity, location, notes } = req.body;
    const userId = req.user.userId;

    if (!restaurant_id || !number || !capacity) {
      return res.status(400).json({ error: 'restaurant_id, number, and capacity required' });
    }

    // Check access to restaurant
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurant_id]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only, Or no such restaurant' });
    }

    const result = await pool.query(
      `INSERT INTO restaurant_tables (restaurant_id, number, capacity, location, notes, status) 
       VALUES ($1, $2, $3, $4, $5, 'available')
       RETURNING *`,
      [restaurant_id, number, capacity, location || null, notes || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Table number already exists in this restaurant' });
    res.status(500).json({ error: err.message });
  }
};

exports.updateTable = async (req, res) => {
  try {
    const { id } = req.params;
    const { number, status, capacity, location, notes } = req.body;
    const userId = req.user.userId;

    if (!status && !number && !capacity && !location && !notes) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    if (status && !TABLE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${TABLE_STATUSES.join(', ')}` });
    }

    // Check access to table's restaurant
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM restaurant_tables t
       JOIN restaurants r ON t.restaurant_id = r.restaurant_id
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE t.table_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only' });
    }

    const result = await pool.query(
      `UPDATE restaurant_tables 
       SET number = $1, status = $2, capacity = $3, location = $4, notes = $5, updated_at = CURRENT_TIMESTAMP
       WHERE table_id = $6
       RETURNING *`,
      [number || null, status || null, capacity || null, location || null, notes || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteTable = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Check access
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM restaurant_tables t
       JOIN restaurants r ON t.restaurant_id = r.restaurant_id
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE t.table_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only' });
    }

    const result = await pool.query(
      'DELETE FROM restaurant_tables WHERE table_id = $1 RETURNING table_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    res.json({ message: 'Table deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};