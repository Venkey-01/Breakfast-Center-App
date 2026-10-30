const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { supabase } = require('../db/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'breakfast_center_secret_2024';

// Customer signup only
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, mobile, role } = req.body;

    if (role === 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Owner accounts cannot be created via public signup. Please log in with the pre-configured admin credentials.'
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already registered. Please login.' });
    }

    const user = new User({ name, email, password, mobile: mobile || '', role: 'user' });
    await user.save();

    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, _id: user.id, name: user.name, email: user.email, role: user.role, mobile: user.mobile }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Login for both customers and admin
router.post('/login', async (req, res) => {
  try {
    const { email, password, requireAdmin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found with this email. Please check your credentials.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    if (requireAdmin && user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This account does not have Restaurant Owner / Admin privileges.'
      });
    }

    const token = jwt.sign(
      { userId: user.id, name: user.name, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, _id: user.id, name: user.name, email: user.email, role: user.role, mobile: user.mobile }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// List customers (Admin only)
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

    if (decoded.role !== 'admin') return res.status(403).json({ success: false, message: 'Restaurant Owner only' });

    const users = await User.find({}, { password: 0 });
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Password & Credentials
const handleUpdateCredentials = async (req, res) => {
  try {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtErr) {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const { name, email, mobile, currentPassword, newPassword } = req.body;

    // Verify current password if user wants to change password
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
      }
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
      }
    }

    let updatedEmail = user.email;
    if (email && email.toLowerCase().trim() !== user.email.toLowerCase().trim()) {
      const existing = await User.findOne({ email: email.toLowerCase().trim() });
      if (existing && String(existing.id) !== String(user.id)) {
        return res.status(409).json({ success: false, message: 'This email is already in use by another account.' });
      }
      updatedEmail = email.toLowerCase().trim();
    }

    const payload = {
      name: name !== undefined ? name.trim() : user.name,
      email: updatedEmail,
      mobile: mobile !== undefined ? mobile.trim() : user.mobile,
      updated_at: new Date().toISOString()
    };

    if (newPassword) {
      payload.password = await bcrypt.hash(newPassword, 10);
    }

    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', user.id)
      .select()
      .single();

    if (error) {
      return res.status(500).json({ success: false, message: error.message });
    }

    const updatedUser = {
      id: data.id,
      _id: data.id,
      name: data.name,
      email: data.email,
      role: data.role,
      mobile: data.mobile
    };

    const newToken = jwt.sign(
      { userId: updatedUser.id, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Password & credentials updated successfully!',
      token: newToken,
      user: updatedUser
    });
  } catch (err) {
    console.error('Update credentials error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

router.put('/update-credentials', handleUpdateCredentials);
router.put('/profile', handleUpdateCredentials);

module.exports = router;
