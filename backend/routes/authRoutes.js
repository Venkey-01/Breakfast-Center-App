const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'breakfast_center_secret_2024';

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, mobile, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const assignedRole = (role === 'admin' && req.body.adminPasscode === (process.env.ADMIN_PASSCODE || 'admin123'))
      ? 'admin'
      : 'user';

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
    }

    const user = new User({ name, email, password, mobile: mobile || '', role: assignedRole });
    await user.save();

    const token = jwt.sign(
      { userId: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, adminPasscode, requireAdmin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this email. Please sign up.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    if (requireAdmin || user.role === 'admin') {
      if (requireAdmin && user.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied. This email is not registered as an Admin.' });
      }
      if (adminPasscode && adminPasscode !== (process.env.ADMIN_PASSCODE || 'admin123')) {
        return res.status(403).json({ success: false, message: 'Invalid admin secret passcode.' });
      }
    }

    const token = jwt.sign(
      { userId: user._id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/users', async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Admin only' });

    const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
