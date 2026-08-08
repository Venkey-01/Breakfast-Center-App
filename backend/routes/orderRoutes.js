const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const { appendRowToSheet } = require('../services/sheetsService');
const { sendEmail } = require('../services/emailService');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '';
const inMemoryOrders = [];

function createHtmlReceipt(order) {
  const itemsList = (order.items && order.items.length > 0)
    ? order.items.map(i => `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${i.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${i.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${i.price * i.quantity}</td>
      </tr>`).join('')
    : `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${order.item}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${order.quantity || 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${order.price}</td>
      </tr>`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 550px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px; background: #ffffff;">
      <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 16px;">
        <h1 style="color: #2e7d32; margin: 0;">🍳 Breakfast Center</h1>
        <p style="color: #666; margin: 4px 0 0 0;">Official Digital Order Receipt & Bill</p>
      </div>
      <div style="margin: 20px 0; color: #333;">
        <p style="margin: 4px 0;"><strong>Customer Name:</strong> ${order.name}</p>
        <p style="margin: 4px 0;"><strong>Order ID:</strong> ${order._id}</p>
        <p style="margin: 4px 0;"><strong>Date:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> <span style="color: #2e7d32; font-weight: bold;">${order.status}</span></p>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <thead>
          <tr style="background: #f4f6f4; text-align: left; color: #2e7d32;">
            <th style="padding: 10px;">Item</th>
            <th style="padding: 10px; text-align: center;">Qty</th>
            <th style="padding: 10px; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>${itemsList}</tbody>
      </table>
      <div style="margin-top: 20px; text-align: right; font-size: 15px; color: #444;">
        <p style="margin: 4px 0;">Subtotal: ₹${order.subtotal || order.price || 0}</p>
        <p style="margin: 4px 0;">GST (5%): ₹${order.tax || 0}</p>
        <h3 style="margin: 10px 0 0 0; color: #2e7d32; font-size: 20px;">Grand Total: ₹${order.grandTotal || order.price}</h3>
      </div>
      <div style="margin-top: 30px; padding-top: 16px; border-top: 1px dashed #ccc; text-align: center; color: #888; font-size: 12px;">
        <p style="margin: 0;">Thank you for dining with Breakfast Center! 🥞</p>
        <p style="margin: 4px 0;">Freshly prepared with love & quality ingredients.</p>
      </div>
    </div>
  `;
}

router.post('/', async (req, res) => {
  try {
    const { name, email, mobile, items, item, quantity, price, subtotal, tax, grandTotal } = req.body;
    const computedSubtotal = subtotal || (items ? items.reduce((acc, i) => acc + (i.price * i.quantity), 0) : price);
    const computedTax = tax || Math.round(computedSubtotal * 0.05);
    const computedGrandTotal = grandTotal || (computedSubtotal + computedTax);

    const orderData = {
      _id: 'ORD' + Date.now().toString().slice(-6),
      name: name || 'Guest',
      email: email || '',
      mobile: mobile || '',
      items: items || (item ? [{ name: item, price: price / (quantity || 1), quantity: quantity || 1 }] : []),
      item: item || (items && items.length > 0 ? items[0].name : 'Breakfast Meal'),
      quantity: quantity || (items && items.length > 0 ? items[0].quantity : 1),
      price: price || computedGrandTotal,
      subtotal: computedSubtotal,
      tax: computedTax,
      grandTotal: computedGrandTotal,
      status: 'Pending',
      createdAt: new Date()
    };

    let order = null;
    try {
      if (mongoose.connection.readyState === 1) {
        order = new Order(orderData);
        await Promise.race([
          order.save(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1000))
        ]);
      } else {
        order = orderData;
      }
    } catch (dbErr) {
      order = orderData;
    }

    inMemoryOrders.unshift(order);

    if (SPREADSHEET_ID) {
      const itemsSummary = order.items && order.items.length > 0
        ? order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
        : `${order.item} (x${order.quantity})`;

      appendRowToSheet(SPREADSHEET_ID, 'Sheet1!A:G', [
        new Date().toLocaleString(),
        order.name,
        order.email || 'N/A',
        order.mobile || 'N/A',
        itemsSummary,
        `₹${order.grandTotal}`,
        order.status
      ]).catch(err => console.error('Sheet Auto-sync warning:', err.message));
    }

    if (order.email && order.email.includes('@')) {
      sendEmail({
        to: order.email,
        subject: `🍳 Breakfast Center Order Receipt #${order._id.toString().slice(-6)}`,
        html: createHtmlReceipt(order)
      }).catch(err => console.error('Resend email error:', err.message));
    }

    res.status(201).json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    let filter = {};
    if (req.query.name) filter.name = new RegExp(req.query.name, 'i');
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { name: new RegExp(req.query.search, 'i') },
        { email: new RegExp(req.query.search, 'i') }
      ];
    }

    let orders = [];
    try {
      if (mongoose.connection.readyState === 1) {
        orders = await Promise.race([
          Order.find(filter).sort({ createdAt: -1 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1000))
        ]);
      } else {
        orders = [...inMemoryOrders];
        if (req.query.name) orders = orders.filter(o => o.name === req.query.name);
      }
    } catch (dbErr) {
      orders = [...inMemoryOrders];
      if (req.query.name) orders = orders.filter(o => o.name === req.query.name);
    }

    if (!orders || orders.length === 0) {
      orders = [...inMemoryOrders];
      if (req.query.name) orders = orders.filter(o => o.name === req.query.name);
    }

    res.json(orders);
  } catch (err) {
    res.json(inMemoryOrders);
  }
});

router.get('/stats', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let allOrders = [];
    try {
      allOrders = await Order.find({}).sort({ createdAt: -1 });
    } catch (e) {
      allOrders = [...inMemoryOrders];
    }

    const totalRevenue = allOrders.reduce((sum, o) => sum + (o.grandTotal || o.price || 0), 0);
    const todayRevenue = allOrders.filter(o => new Date(o.createdAt) >= todayStart)
      .reduce((sum, o) => sum + (o.grandTotal || o.price || 0), 0);
    const weekRevenue = allOrders.filter(o => new Date(o.createdAt) >= weekStart)
      .reduce((sum, o) => sum + (o.grandTotal || o.price || 0), 0);
    const monthRevenue = allOrders.filter(o => new Date(o.createdAt) >= monthStart)
      .reduce((sum, o) => sum + (o.grandTotal || o.price || 0), 0);

    const statusCounts = { Pending: 0, Preparing: 0, Completed: 0, Cancelled: 0 };
    allOrders.forEach(o => {
      const s = o.status || 'Pending';
      if (statusCounts[s] !== undefined) statusCounts[s]++;
    });

    const itemCounts = {};
    allOrders.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(i => { itemCounts[i.name] = (itemCounts[i.name] || 0) + (i.quantity || 1); });
      }
    });

    res.json({
      success: true,
      stats: {
        totalOrders: allOrders.length,
        totalRevenue,
        todayRevenue,
        weekRevenue,
        monthRevenue,
        statusCounts,
        topItems: Object.entries(itemCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.id;
    let order = null;

    const memOrder = inMemoryOrders.find(o => String(o._id) === String(orderId));
    if (memOrder) {
      memOrder.status = status;
      order = memOrder;
    }

    try {
      if (mongoose.connection.readyState === 1) {
        const dbOrder = await Promise.race([
          Order.findByIdAndUpdate(orderId, { status }, { new: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), 1000))
        ]);
        if (dbOrder) order = dbOrder;
      }
    } catch (dbErr) {}

    if (!order) {
      order = { _id: orderId, status };
    }

    let targetEmail = order.email;
    if (!targetEmail && order.name && mongoose.connection.readyState === 1) {
      try {
        const matchingUser = await User.findOne({ name: new RegExp('^' + order.name.trim() + '$', 'i') });
        if (matchingUser) targetEmail = matchingUser.email;
      } catch (e) {}
    }

    if (targetEmail && targetEmail.includes('@') && (status === 'Completed' || status === 'Preparing' || status === 'Cancelled')) {
      sendEmail({
        to: targetEmail,
        subject: `🍳 Breakfast Center Order Update #${String(order._id).slice(-6)}: ${status}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; border: 1px solid #2e7d32; border-radius: 12px; padding: 24px; background: #ffffff;">
            <div style="text-align: center; border-bottom: 2px solid #2e7d32; padding-bottom: 12px;">
              <h1 style="color: #2e7d32; margin: 0;">🍳 Breakfast Center</h1>
              <p style="color: #666; margin: 4px 0 0 0;">Live Order Status Notification</p>
            </div>
            <div style="margin: 20px 0; color: #333;">
              <p style="font-size: 16px;">Hello <strong>${order.name || 'Customer'}</strong>!</p>
              <p style="font-size: 15px;">Your order status has been updated to:</p>
              <div style="background: #e8f5e9; border: 1px solid #a5d6a7; padding: 14px; border-radius: 10px; text-align: center; margin: 16px 0;">
                <span style="color: #1b5e20; font-size: 20px; font-weight: bold;">${status}</span>
              </div>
              <p style="color: #666; font-size: 13px;">Order ID: #${String(order._id).slice(-6)}</p>
            </div>
            <div style="border-top: 1px dashed #ccc; padding-top: 12px; text-align: center; color: #888; font-size: 12px;">
              Thank you for dining with Breakfast Center! 🥞
            </div>
          </div>
        `
      }).catch(err => console.error('Status email alert failed:', err.message));
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
