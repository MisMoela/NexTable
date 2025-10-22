const pool = require('../db/connection');

exports.getAllMenuItems = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const userId = req.user.userId;
    const { category } = req.query;  // Optional filter

    // Check access
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurantId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only' });
    }

    let query = `
      SELECT * FROM menu_items 
      WHERE restaurant_id = $1 AND is_available = true
    `;
    let params = [restaurantId];

    if (category) {
      query += ` AND category ILIKE $${params.length + 1}`;
      params.push(`%${category}%`);
    }

    query += ` ORDER BY category, name`;
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMenuItemById = async (req, res) => {
  try {
    const { restaurantId, id } = req.params;
    const userId = req.user.userId;

    // Check access
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM menu_items m
       JOIN user_restaurants ur ON m.restaurant_id = ur.restaurant_id
       WHERE m.menu_item_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `SELECT * FROM menu_items WHERE menu_item_id = $1 AND restaurant_id = $2`,
      [id, restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createMenuItem = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, description, price, category, image_url, allergens, modifiers } = req.body;
    const userId = req.user.userId;

    if (!name || !price || !category) {
      return res.status(400).json({ error: 'name, price, and category required' });
    }

    if (price < 0) {
      return res.status(400).json({ error: 'Price must be non-negative' });
    }

    // Check access
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurantId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only' });
    }

    const result = await pool.query(
      `INSERT INTO menu_items (restaurant_id, name, description, price, category, image_url, is_available, allergens, modifiers) 
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8) 
       RETURNING *`,
      [restaurantId, name, description || null, price, category, image_url || null, allergens || '[]', modifiers || '{}']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { restaurantId, id } = req.params;
    const { name, description, price, category, image_url, is_available, allergens, modifiers } = req.body;
    const userId = req.user.userId;

    if (!name && !description && price === undefined && !category && !image_url && is_available === undefined && !allergens && !modifiers) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    if (price !== undefined && price < 0) {
      return res.status(400).json({ error: 'Price must be non-negative' });
    }

    // Check access
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM menu_items m
       JOIN user_restaurants ur ON m.restaurant_id = ur.restaurant_id
       WHERE m.menu_item_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await pool.query(
      `UPDATE menu_items 
       SET name = $1, description = $2, price = $3, category = $4, image_url = $5, is_available = $6, allergens = $7, modifiers = $8, updated_at = CURRENT_TIMESTAMP
       WHERE menu_item_id = $9 AND restaurant_id = $10
       RETURNING *`,
      [name || null, description || null, price, category || null, image_url || null, is_available, allergens || '[]', modifiers || '{}', id, restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { restaurantId, id } = req.params;
    const userId = req.user.userId;

    // Check access
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM menu_items m
       JOIN user_restaurants ur ON m.restaurant_id = ur.restaurant_id
       WHERE m.menu_item_id = $1 AND ur.user_id = $2 AND ur.is_active = true`,
      [id, userId]
    );

    if (accessResult.rows.length === 0 || accessResult.rows[0].assignment_role !== 'owner') {
      return res.status(403).json({ error: 'Unauthorized: Owner only' });
    }

    const result = await pool.query(
      'DELETE FROM menu_items WHERE menu_item_id = $1 AND restaurant_id = $2 RETURNING menu_item_id',
      [id, restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Menu item not found' });
    }

    res.json({ message: 'Menu item deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};