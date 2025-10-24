const pool = require('../db/connection');

// Enums
const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'served', 'cancelled', 'paid'];

exports.getAllOrders = async (req, res) => {
  try {
    const { restaurantId } = req.params;  // From path
    const userId = req.user.userId;
    const { status } = req.query;  // Optional

    // Check access to restaurant
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurantId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager', 'waiter', 'chef', 'customer'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Access to restaurant denied' });
    }

    let query = `
      SELECT o.order_id, o.placed_by_user_id, o.table_id, o.status, o.total, o.notes, o.estimated_ready, o.created_at,
             u.email as placed_by_email, t.number as table_number
      FROM orders o
      LEFT JOIN users u ON o.placed_by_user_id = u.user_id
      LEFT JOIN restaurant_tables t ON o.table_id = t.table_id
      WHERE o.restaurant_id = $1
    `;
    let params = [restaurantId];

    if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}` });
      }
      query += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;
    const result = await pool.query(query, params);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const { restaurantId, id } = req.params;  // id as :id
    const userId = req.user.userId;

    // Check access via restaurant
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.restaurant_id
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE o.order_id = $1 AND r.restaurant_id = $2 AND ur.user_id = $3 AND ur.is_active = true`,
      [id, restaurantId, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager', 'waiter', 'chef', 'customer'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Access denied' });
    }

    // Get order with subtotal
    const result = await pool.query(
      `SELECT o.*, u.email as placed_by_email, t.number as table_number,
             (SELECT COALESCE(SUM(oi.quantity * oi.price_at_order), 0) FROM order_items oi WHERE oi.order_id = o.order_id) as subtotal
       FROM orders o
       LEFT JOIN users u ON o.placed_by_user_id = u.user_id
       LEFT JOIN restaurant_tables t ON o.table_id = t.table_id
       WHERE o.order_id = $1 AND o.restaurant_id = $2`,
      [id, restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getOrdersByTable = async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;  // From path
    const userId = req.user.userId;
    const { status } = req.query;  // Optional filter

    // Check access to restaurant
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurantId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager', 'waiter', 'chef', 'customer'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Access to restaurant denied' });
    }

    // Validate table belongs to restaurant
    const tableCheck = await pool.query(
      `SELECT table_id FROM restaurant_tables WHERE table_id = $1 AND restaurant_id = $2`,
      [tableId, restaurantId]
    );

    if (tableCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found in this restaurant' });
    }

    let query = `
      SELECT o.order_id, o.placed_by_user_id, o.status, o.total, o.notes, o.estimated_ready, o.created_at,
             u.email as placed_by_email
      FROM orders o
      LEFT JOIN users u ON o.placed_by_user_id = u.user_id
      WHERE o.restaurant_id = $1 AND o.table_id = $2
    `;
    let params = [restaurantId, tableId];

    if (status) {
      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}` });
      }
      query += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;
    const result = await pool.query(query, params);

    res.json({
      restaurant_id: parseInt(restaurantId),
      table_id: parseInt(tableId),
      orders: result.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createOrder = async (req, res) => {
  try {
    const { restaurantId } = req.params;  // From path
    const { table_id, items, notes } = req.body;
    const userId = req.user.userId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }

    // Check access to restaurant
    const accessResult = await pool.query(
      `SELECT assignment_role FROM user_restaurants 
       WHERE user_id = $1 AND restaurant_id = $2 AND is_active = true`,
      [userId, restaurantId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager', 'waiter', 'customer'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Access to restaurant denied' });
    }

    // Validate table if provided
    if (table_id) {
      const tableResult = await pool.query(
        `SELECT table_id FROM restaurant_tables WHERE table_id = $1 AND restaurant_id = $2`,
        [table_id, restaurantId]
      );
      if (tableResult.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid table for this restaurant' });
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `INSERT INTO orders (restaurant_id, placed_by_user_id, table_id, status, notes) 
         VALUES ($1, $2, $3, 'pending', $4) 
         RETURNING order_id`,
        [restaurantId, userId, table_id || null, notes || null]
      );

      const orderId = orderResult.rows[0].order_id;

      let total = 0;
      for (const item of items) {
        if (!item.menu_item_id || !item.quantity || item.quantity <= 0) {
          throw new Error('Invalid item: menu_item_id and quantity > 0 required');
        }

        const priceResult = await client.query(
          `SELECT price FROM menu_items WHERE menu_item_id = $1 AND restaurant_id = $2 AND is_available = true`,
          [item.menu_item_id, restaurantId]
        );

        if (priceResult.rows.length === 0) {
          throw new Error(`Menu item ${item.menu_item_id} not found or unavailable`);
        }

        const priceAtOrder = priceResult.rows[0].price;
        total += item.quantity * priceAtOrder;

        await client.query(
          `INSERT INTO order_items (order_id, menu_item_id, quantity, price_at_order, notes) 
           VALUES ($1, $2, $3, $4, $5)`,
          [orderId, item.menu_item_id, item.quantity, priceAtOrder, item.notes || null]
        );
      }

      await client.query(
        `UPDATE orders SET total = $1 WHERE order_id = $2`,
        [total, orderId]
      );

      await client.query('COMMIT');

      const fullResult = await pool.query(
        `SELECT o.*, u.email as placed_by_email, t.number as table_number
         FROM orders o
         LEFT JOIN users u ON o.placed_by_user_id = u.user_id
         LEFT JOIN restaurant_tables t ON o.table_id = t.table_id
         WHERE o.order_id = $1`,
        [orderId]
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

exports.updateOrder = async (req, res) => {
  try {
    const { restaurantId, id } = req.params;  // id as :id
    const { status, notes, estimated_ready } = req.body;
    const userId = req.user.userId;

    if (status && !ORDER_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${ORDER_STATUSES.join(', ')}` });
    }

    if (!status && !notes && !estimated_ready) {
      return res.status(400).json({ error: 'At least one field required' });
    }

    // Check access
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.restaurant_id
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE o.order_id = $1 AND r.restaurant_id = $2 AND ur.user_id = $3 AND ur.is_active = true`,
      [id, restaurantId, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager', 'waiter', 'chef'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Staff access only' });
    }

    const result = await pool.query(
      `UPDATE orders 
       SET status = $1, notes = $2, estimated_ready = $3, updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $4 AND restaurant_id = $5
       RETURNING *`,
      [status || null, notes || null, estimated_ready || null, id, restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const { restaurantId, id } = req.params;  // id as :id
    const userId = req.user.userId;

    // Check access
    const accessResult = await pool.query(
      `SELECT ur.assignment_role 
       FROM orders o
       JOIN restaurants r ON o.restaurant_id = r.restaurant_id
       JOIN user_restaurants ur ON r.restaurant_id = ur.restaurant_id
       WHERE o.order_id = $1 AND r.restaurant_id = $2 AND ur.user_id = $3 AND ur.is_active = true`,
      [id, restaurantId, userId]
    );

    if (accessResult.rows.length === 0 || !['owner', 'manager'].includes(accessResult.rows[0].assignment_role)) {
      return res.status(403).json({ error: 'Unauthorized: Owner or manager only' });
    }

    const result = await pool.query(
      'DELETE FROM orders WHERE order_id = $1 AND restaurant_id = $2 RETURNING order_id',
      [id, restaurantId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({ message: 'Order deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};