import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Utensils, ShoppingCart, Clock, CheckCircle, XCircle, LogOut, Plus, Minus, RefreshCw,
  Receipt, Printer, ShieldCheck, UserCheck, Lock, Users, TrendingUp, Search,
  Download, Eye, Star, BarChart2, ChefHat, Mail, Phone
} from 'lucide-react';
import confetti from 'canvas-confetti';

import idliImg from './assets/idli.png';
import dosaImg from './assets/dosa.png';
import vadaImg from './assets/vada.png';

const API_BASE = '/api';
const ADMIN_PASSCODE = 'admin123';

const IMAGES = {
  Idli: idliImg || 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
  Dosa: dosaImg || 'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?w=600&auto=format&fit=crop&q=80',
  Vada: vadaImg || 'https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=600&auto=format&fit=crop&q=80',
};

const getToken = () => localStorage.getItem('token');
const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

const getGreeting = () => {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'Good Morning', icon: '☀️', quote: 'Start your day with fresh South Indian breakfast!' };
  if (h >= 12 && h < 17) return { text: 'Good Afternoon', icon: '🌤️', quote: 'Fuel your afternoon with hot breakfast favorites!' };
  return { text: 'Good Evening', icon: '🌙', quote: 'Craving a warm crispy dosa or vada tonight?' };
};

export default function App() {
  const greeting = getGreeting();

  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')) || null; } catch { return null; }
  });
  const [view, setView] = useState(() => {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    if (!u) return 'auth';
    return u.role === 'admin' ? 'admin' : 'menu';
  });

  const [authTab, setAuthTab] = useState('login');
  const [authMode, setAuthMode] = useState('none');
  const [form, setForm] = useState({ name: '', email: '', password: '', mobile: '', adminPasscode: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [quantities, setQuantities] = useState({ Idli: 0, Dosa: 0, Vada: 0 });
  const [showCheckout, setShowCheckout] = useState(false);
  const [orderingEmail, setOrderingEmail] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  const [cartMsg, setCartMsg] = useState('');

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [adminTab, setAdminTab] = useState('orders');
  const [stats, setStats] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const menuItems = [
    { id: 'Idli', name: 'Idli', price: 40, img: IMAGES.Idli, desc: 'Steamed fluffy rice cakes with coconut chutney & sambar' },
    { id: 'Dosa', name: 'Dosa', price: 60, img: IMAGES.Dosa, desc: 'Crispy golden crepe filled with spiced potato masala' },
    { id: 'Vada', name: 'Vada', price: 50, img: IMAGES.Vada, desc: 'Crispy deep-fried savory lentil donuts' },
  ];

  const handleAuth = async (isAdmin = false) => {
    setAuthError('');
    if (!form.email || !form.password) { setAuthError('Email and password required.'); return; }
    if (authTab === 'signup' && !form.name) { setAuthError('Name is required.'); return; }
    if (isAdmin && authTab === 'login' && form.adminPasscode !== ADMIN_PASSCODE) {
      setAuthError('Invalid admin passcode.'); return;
    }

    setAuthLoading(true);
    try {
      const endpoint = authTab === 'login' ? '/auth/login' : '/auth/signup';
      const payload = authTab === 'signup'
        ? { name: form.name, email: form.email, password: form.password, mobile: form.mobile, role: isAdmin ? 'admin' : 'user', adminPasscode: form.adminPasscode }
        : { email: form.email, password: form.password, requireAdmin: isAdmin, adminPasscode: isAdmin ? form.adminPasscode : undefined };

      const res = await axios.post(`${API_BASE}${endpoint}`, payload);

      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
        setOrderingEmail(res.data.user.email || '');
        setView(res.data.user.role === 'admin' ? 'admin' : 'menu');
      } else {
        setAuthError(res.data.message || 'Authentication failed.');
      }
    } catch (err) {
      setAuthError(err.response?.data?.message || 'Server error. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    setAuthMode('none');
    setAuthTab('login');
    setForm({ name: '', email: '', password: '', mobile: '', adminPasscode: '' });
    setView('auth');
  };

  const updateQty = (id, d) => setQuantities(p => ({ ...p, [id]: Math.max(0, (p[id] || 0) + d) }));
  const selectedItems = menuItems.filter(i => quantities[i.name] > 0);
  const subtotal = selectedItems.reduce((a, i) => a + i.price * quantities[i.name], 0);
  const tax = Math.round(subtotal * 0.05);
  const grandTotal = subtotal + tax;

  const fetchOrders = useCallback(async (customSearch, customStatus) => {
    setLoadingOrders(true);
    try {
      const params = {};
      const q = customSearch !== undefined ? customSearch : searchQuery;
      const s = customStatus !== undefined ? customStatus : statusFilter;
      if (q) params.search = q;
      if (s) params.status = s;
      const res = await axios.get(`${API_BASE}/orders`, { params });
      if (Array.isArray(res.data)) setOrders(res.data);
    } catch (err) { console.error(err); }
    finally { setLoadingOrders(false); }
  }, [searchQuery, statusFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/orders/stats`, { headers: authHeader() });
      if (res.data.success) setStats(res.data.stats);
    } catch (err) { console.error(err); }
  }, []);

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/auth/users`, { headers: authHeader() });
      if (res.data.success) setCustomers(res.data.users);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    if (view === 'status' || view === 'admin') fetchOrders();
    if (view === 'admin') { fetchStats(); fetchCustomers(); }
  }, [view]);

  useEffect(() => {
    if (user) setOrderingEmail(user.email || '');
  }, [user]);

  const handlePlaceOrder = async () => {
    if (selectedItems.length === 0) { alert('Cart is empty!'); return; }
    setIsPlacing(true);
    try {
      const payload = {
        name: user?.name || 'Guest',
        email: orderingEmail,
        items: selectedItems.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: quantities[i.name] })),
        subtotal, tax, grandTotal
      };
      const res = await axios.post(`${API_BASE}/orders`, payload);
      const created = res.data.order || res.data;
      setOrders(prev => [created, ...prev]);
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      setShowCheckout(false);
      setQuantities({ Idli: 0, Dosa: 0, Vada: 0 });
      setSelectedInvoice(created);
      setCartMsg('🎉 Order placed! Bill generated below.');
      setTimeout(() => setCartMsg(''), 7000);
    } catch { alert('Failed to place order. Try again.'); }
    finally { setIsPlacing(false); }
  };

  const updateStatus = async (id, status) => {
    setOrders(prev => prev.map(o => String(o._id) === String(id) ? { ...o, status } : o));
    try { await axios.put(`${API_BASE}/orders/${id}`, { status }); } catch (err) { console.error(err); }
  };

  const exportCSV = () => {
    const rows = [['Order ID', 'Customer', 'Email', 'Items', 'Total', 'Status', 'Date']];
    orders.forEach(o => {
      const items = o.items?.map(i => `${i.name}x${i.quantity}`).join('; ') || o.item;
      rows.push([String(o._id).slice(-8), o.name, o.email, items, `₹${o.grandTotal || o.price}`, o.status || 'Pending', new Date(o.createdAt).toLocaleDateString()]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; a.click();
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px' }}>
      {view === 'auth' && (
        <div className="bright-card animate-fade-in" style={{ width: '100%', maxWidth: '440px', padding: '40px 32px', textAlign: 'center', marginTop: '40px' }}>
          <div style={{ background: '#e8f5e9', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Utensils size={32} color="#2e7d32" />
          </div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: '800', color: '#1e293b', marginBottom: '6px' }}>Breakfast Center</h1>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>{greeting.icon} {greeting.text}! Order fresh breakfast in seconds.</p>

          {authMode === 'none' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button className="btn-green" style={{ width: '100%', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => setAuthMode('customer')}>
                <UserCheck size={20} /> Customer Login / Sign Up
              </button>
              <button style={{ width: '100%', padding: '12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '12px', fontWeight: '700', color: '#334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={() => setAuthMode('admin')}>
                <ShieldCheck size={18} color="#2e7d32" /> Restaurant Admin Portal
              </button>
            </div>
          )}

          {authMode === 'customer' && (
            <div className="animate-fade-in" style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.15rem', color: '#1e293b', textAlign: 'center', fontWeight: '700', marginBottom: '16px' }}>
                {authTab === 'login' ? '👋 Welcome Back' : '🎉 Create Account'}
              </h2>
              <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '10px', padding: '4px', marginBottom: '16px' }}>
                {['login', 'signup'].map(t => (
                  <button key={t} onClick={() => { setAuthTab(t); setAuthError(''); }}
                    style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem', background: authTab === t ? '#2e7d32' : 'transparent', color: authTab === t ? 'white' : '#64748b' }}>
                    {t === 'login' ? 'Login' : 'Sign Up'}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {authTab === 'signup' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Full Name *</label>
                    <input type="text" placeholder="Your full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                )}
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Email Address *</label>
                  <input type="email" placeholder="yourname@gmail.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Password *</label>
                  <input type="password" placeholder="Minimum 6 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                {authTab === 'signup' && (
                  <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Mobile (optional)</label>
                    <input type="text" placeholder="Phone number" value={form.mobile} onChange={e => setForm({ ...form, mobile: e.target.value })} />
                  </div>
                )}
                {authError && <div style={{ color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '500' }}>{authError}</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button className="btn-green" style={{ flex: 1 }} onClick={() => handleAuth(false)} disabled={authLoading}>
                    {authLoading ? 'Please wait...' : (authTab === 'login' ? 'Login →' : 'Create Account →')}
                  </button>
                  <button style={{ background: '#e2e8f0', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: '600' }} onClick={() => setAuthMode('none')}>Back</button>
                </div>
              </div>
            </div>
          )}

          {authMode === 'admin' && (
            <div className="animate-fade-in" style={{ textAlign: 'left' }}>
              <h2 style={{ fontSize: '1.15rem', color: '#2e7d32', textAlign: 'center', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Lock size={18} /> Restaurant Admin Portal
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Admin Email *</label>
                  <input type="email" placeholder="admin@restaurant.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Password *</label>
                  <input type="password" placeholder="Admin password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#475569' }}>Admin Secret Passcode *</label>
                  <input type="password" placeholder="Enter secret passcode" value={form.adminPasscode} onChange={e => setForm({ ...form, adminPasscode: e.target.value })} />
                </div>
                {authError && <div style={{ color: '#dc2626', background: '#fef2f2', padding: '10px 14px', borderRadius: '8px', fontSize: '0.88rem', fontWeight: '500' }}>{authError}</div>}
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button className="btn-gold" style={{ flex: 1 }} onClick={() => handleAuth(true)} disabled={authLoading}>
                    {authLoading ? 'Verifying...' : 'Admin Login →'}
                  </button>
                  <button style={{ background: '#e2e8f0', border: 'none', borderRadius: '8px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600' }} onClick={() => setAuthMode('none')}>Back</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view !== 'auth' && (
        <div style={{ width: '100%', maxWidth: '1100px' }}>
          <div className="bright-card" style={{ padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: '#e8f5e9', padding: '8px', borderRadius: '12px' }}>
                <Utensils size={24} color="#2e7d32" />
              </div>
              <div>
                <h1 style={{ fontSize: '1.35rem', color: '#2e7d32', fontWeight: '800', lineHeight: 1.1 }}>Breakfast Center</h1>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Fresh & Fast Quality Food</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {user?.role === 'user' && (
                <>
                  <NavBtn label="Menu" active={view === 'menu'} onClick={() => setView('menu')} />
                  <NavBtn label="My Orders" active={view === 'status'} onClick={() => { setView('status'); fetchOrders(); }} />
                </>
              )}
              {user?.role === 'admin' && (
                <NavBtn label="Dashboard" active={view === 'admin'} onClick={() => setView('admin')} />
              )}
              <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>👤 {user?.name}</span>
              <button onClick={handleLogout} style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '8px 12px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                <LogOut size={15} /> Logout
              </button>
            </div>
          </div>

          <div className="bright-card animate-fade-in" style={{ padding: '18px 24px', marginBottom: '20px', background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>{greeting.icon} {greeting.text}, {user?.name?.split(' ')[0]}!</div>
              <p style={{ color: '#c8e6c9', fontSize: '0.88rem', margin: 0 }}>{greeting.quote}</p>
            </div>
            {selectedItems.length > 0 && view === 'menu' && user?.role === 'user' && (
              <button className="btn-gold" onClick={() => setShowCheckout(true)} style={{ padding: '10px 20px' }}>
                <ShoppingCart size={18} /> Cart ({selectedItems.reduce((a, i) => a + quantities[i.name], 0)}) • ₹{grandTotal}
              </button>
            )}
          </div>

          {cartMsg && (
            <div style={{ marginBottom: '20px', background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', padding: '12px 18px', borderRadius: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} /> {cartMsg}
            </div>
          )}

          {view === 'menu' && (
            <div className="bright-card animate-fade-in" style={{ padding: '28px' }}>
              <h2 style={{ fontSize: '1.6rem', color: '#1e293b', fontWeight: '800', marginBottom: '6px', textAlign: 'center' }}>🍳 Fresh Breakfast Menu</h2>
              <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>Select items and place your order for an instant digital bill.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '20px' }}>
                {menuItems.map(item => (
                  <div key={item.id} style={{ width: '300px', background: '#fff', borderRadius: '18px', border: '1px solid #e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '18px', display: 'flex', flexDirection: 'column' }}>
                    <img src={item.img} alt={item.name} style={{ width: '100%', height: '165px', objectFit: 'cover', borderRadius: '12px', marginBottom: '14px' }} onError={e => e.target.style.display = 'none'} />
                    <h3 style={{ fontSize: '1.2rem', color: '#1e293b', fontWeight: '700', marginBottom: '4px' }}>{item.name}</h3>
                    <p style={{ color: '#64748b', fontSize: '0.83rem', marginBottom: '12px', flex: 1 }}>{item.desc}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '10px 0' }}>
                      <span style={{ color: '#2e7d32', fontWeight: '800', fontSize: '1.15rem' }}>₹{item.price} <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 'normal' }}>/ plate</span></span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '4px 10px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <button onClick={() => updateQty(item.name, -1)} style={{ background: '#e2e8f0', border: 'none', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
                        <span style={{ minWidth: '18px', textAlign: 'center', fontWeight: '700' }}>{quantities[item.name]}</span>
                        <button onClick={() => updateQty(item.name, 1)} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
                      </div>
                    </div>
                    <button className="btn-green" onClick={() => { if (!quantities[item.name]) updateQty(item.name, 1); setShowCheckout(true); }} style={{ width: '100%', marginTop: '6px' }}>
                      <ShoppingCart size={16} /> Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'status' && (
            <div className="bright-card animate-fade-in" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', color: '#1e293b', fontWeight: '800' }}>My Orders & Bills</h2>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Track your active orders and view receipts.</p>
                </div>
                <button onClick={fetchOrders} style={{ background: '#f1f5f9', border: 'none', padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <RefreshCw size={15} /> Refresh
                </button>
              </div>
              {loadingOrders ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Loading orders...</div>
              ) : orders.filter(o => (user?.email && o.email && o.email.toLowerCase() === user.email.toLowerCase()) || o.name === user?.name).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#64748b', background: '#f8fafc', borderRadius: '14px' }}>
                  <Utensils size={40} color="#cbd5e1" style={{ marginBottom: '10px' }} />
                  <p style={{ fontWeight: '600' }}>No orders yet</p>
                  <button className="btn-green" onClick={() => setView('menu')} style={{ marginTop: '14px' }}>Order Now</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {orders.filter(o => (user?.email && o.email && o.email.toLowerCase() === user.email.toLowerCase()) || o.name === user?.name).map(order => (
                    <OrderCard
                      key={order._id}
                      order={order}
                      onViewBill={() => setSelectedInvoice(order)}
                      onCancelOrder={() => updateStatus(order._id, 'Cancelled')}
                      onReorder={() => {
                        const newQs = { Idli: 0, Dosa: 0, Vada: 0 };
                        if (order.items && order.items.length > 0) {
                          order.items.forEach(i => { if (newQs[i.name] !== undefined) newQs[i.name] = i.quantity; });
                        } else if (order.item && newQs[order.item] !== undefined) {
                          newQs[order.item] = order.quantity || 1;
                        }
                        setQuantities(newQs);
                        setView('menu');
                        setShowCheckout(true);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'admin' && (
            <div className="bright-card animate-fade-in" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', color: '#1e293b', fontWeight: '800' }}>Admin Dashboard</h2>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Real-time order management & CRM</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => { fetchOrders(); fetchStats(); fetchCustomers(); }} style={{ background: '#f1f5f9', border: 'none', padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                    <RefreshCw size={14} /> Refresh
                  </button>
                  <button onClick={exportCSV} style={{ background: '#dcfce7', border: 'none', padding: '9px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#15803d' }}>
                    <Download size={14} /> Export CSV
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', background: '#f1f5f9', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
                {[
                  { key: 'orders', icon: <Receipt size={15} />, label: 'Orders' },
                  { key: 'stats', icon: <BarChart2 size={15} />, label: 'Analytics' },
                  { key: 'customers', icon: <Users size={15} />, label: 'Customers' },
                ].map(t => (
                  <button key={t.key} onClick={() => setAdminTab(t.key)} style={{ padding: '8px 16px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '5px', background: adminTab === t.key ? '#2e7d32' : 'transparent', color: adminTab === t.key ? 'white' : '#64748b' }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              {adminTab === 'orders' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
                    <StatCard label="Total Orders" value={orders.length} color="#1e293b" bg="#f8fafc" />
                    <StatCard label="Total Revenue" value={`₹${orders.reduce((a, o) => a + (o.grandTotal || o.price || 0), 0)}`} color="#2e7d32" bg="#e8f5e9" />
                    <StatCard label="Pending" value={orders.filter(o => (o.status || 'Pending') === 'Pending').length} color="#d97706" bg="#fef3c7" />
                    <StatCard label="Completed" value={orders.filter(o => o.status === 'Completed').length} color="#0891b2" bg="#e0f2fe" />
                  </div>

                  <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        placeholder="Search by name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') fetchOrders(e.target.value, statusFilter); }}
                        style={{ paddingLeft: '32px', width: '100%' }}
                      />
                    </div>
                    <select
                      value={statusFilter}
                      onChange={e => { setStatusFilter(e.target.value); fetchOrders(searchQuery, e.target.value); }}
                      style={{ padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '600', cursor: 'pointer' }}
                    >
                      <option value="">All Status</option>
                      <option value="Pending">Pending</option>
                      <option value="Preparing">Preparing</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                    <button onClick={() => fetchOrders(searchQuery, statusFilter)} className="btn-green" style={{ padding: '10px 16px' }}>Search</button>
                  </div>

                  {loadingOrders ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading orders...</div>
                  ) : orders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No orders found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {orders.map(order => (
                        <div key={order._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>
                              #{String(order._id).slice(-8)} • {new Date(order.createdAt || Date.now()).toLocaleString()}
                            </div>
                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '1rem' }}>{order.name} <span style={{ color: '#64748b', fontWeight: '400', fontSize: '0.85rem' }}>({order.email || 'no email'})</span></div>
                            <div style={{ color: '#475569', fontSize: '0.88rem', marginTop: '2px' }}>
                              {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ') || order.item}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                              <span style={{ color: '#2e7d32', fontWeight: '700' }}>₹{order.grandTotal || order.price}</span>
                              <StatusBadge status={order.status || 'Pending'} />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button onClick={() => setSelectedInvoice(order)} style={{ background: '#f1f5f9', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}><Eye size={13} /> Bill</button>
                            <button onClick={() => updateStatus(order._id, 'Preparing')} style={{ background: '#0284c7', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}><ChefHat size={13} /> Prep</button>
                            <button onClick={() => updateStatus(order._id, 'Completed')} style={{ background: '#2e7d32', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}><CheckCircle size={13} /> Done</button>
                            <button onClick={() => updateStatus(order._id, 'Cancelled')} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '0.82rem' }}><XCircle size={13} /> Cancel</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {adminTab === 'stats' && stats && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <StatCard label="Total Revenue" value={`₹${stats.totalRevenue}`} color="#2e7d32" bg="#e8f5e9" />
                    <StatCard label="Today's Revenue" value={`₹${stats.todayRevenue}`} color="#0891b2" bg="#e0f2fe" />
                    <StatCard label="This Week" value={`₹${stats.weekRevenue}`} color="#7c3aed" bg="#f5f3ff" />
                    <StatCard label="This Month" value={`₹${stats.monthRevenue}`} color="#d97706" bg="#fef3c7" />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><BarChart2 size={18} /> Order Status</h3>
                      {Object.entries(stats.statusCounts).map(([s, count]) => (
                        <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                          <StatusBadge status={s} />
                          <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '1.1rem' }}>{count}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#f8fafc', borderRadius: '14px', padding: '20px', border: '1px solid #e2e8f0' }}>
                      <h3 style={{ fontWeight: '700', color: '#1e293b', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><Star size={18} /> Top Items</h3>
                      {stats.topItems.length === 0
                        ? <p style={{ color: '#64748b' }}>No orders yet</p>
                        : stats.topItems.map(([name, count], i) => (
                          <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #e2e8f0' }}>
                            <span style={{ fontWeight: '600', color: '#334155' }}>#{i + 1} {name}</span>
                            <span style={{ fontWeight: '700', color: '#2e7d32' }}>{count} plates</span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {adminTab === 'customers' && (
                <div>
                  <div style={{ marginBottom: '16px', fontWeight: '600', color: '#64748b' }}>
                    {customers.length} registered customers
                  </div>
                  {customers.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No customers yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {customers.map(c => (
                        <div key={c._id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#2e7d32' }}>{c.name?.[0]?.toUpperCase()}</span>
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '700', color: '#1e293b' }}>{c.name} {c.role === 'admin' && <span style={{ background: '#fef3c7', color: '#d97706', fontSize: '0.72rem', padding: '2px 8px', borderRadius: '20px', fontWeight: '600' }}>ADMIN</span>}</div>
                            <div style={{ display: 'flex', gap: '14px', marginTop: '2px', fontSize: '0.85rem', color: '#64748b' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Mail size={13} /> {c.email}</span>
                              {c.mobile && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={13} /> {c.mobile}</span>}
                            </div>
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                            Joined {new Date(c.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showCheckout && user?.role === 'user' && (
        <div className="modal-overlay" onClick={() => setShowCheckout(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={20} color="#2e7d32" /> Order Summary
              </h3>
              <button onClick={() => setShowCheckout(false)} style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>

            <div style={{ marginBottom: '18px' }}>
              {selectedItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <div>
                    <strong style={{ color: '#1e293b' }}>{item.name}</strong>
                    <div style={{ fontSize: '0.83rem', color: '#64748b' }}>₹{item.price} × {quantities[item.name]}</div>
                  </div>
                  <span style={{ fontWeight: '700' }}>₹{item.price * quantities[item.name]}</span>
                </div>
              ))}
            </div>

            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '18px' }}>
              <BillRow label="Subtotal" value={`₹${subtotal}`} />
              <BillRow label="GST (5%)" value={`₹${tax}`} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '800', fontSize: '1.15rem', borderTop: '1px solid #cbd5e1', paddingTop: '10px', marginTop: '8px', color: '#1e293b' }}>
                <span>Grand Total</span><span style={{ color: '#2e7d32' }}>₹{grandTotal}</span>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={{ fontSize: '0.83rem', fontWeight: '600', color: '#475569', display: 'block', marginBottom: '4px' }}>Email for digital receipt:</label>
              <input type="email" placeholder="yourname@gmail.com" value={orderingEmail} onChange={e => setOrderingEmail(e.target.value)} />
            </div>

            <button className="btn-green" style={{ width: '100%' }} disabled={isPlacing} onClick={handlePlaceOrder}>
              {isPlacing ? 'Placing Order...' : `Confirm Order • ₹${grandTotal}`}
            </button>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="modal-overlay" onClick={() => setSelectedInvoice(null)}>
          <div className="modal-content printable-invoice" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ textAlign: 'center', borderBottom: '2px solid #2e7d32', paddingBottom: '14px', marginBottom: '18px' }}>
              <h2 style={{ color: '#2e7d32', fontSize: '1.5rem', fontWeight: '800', margin: 0 }}>🍳 Breakfast Center</h2>
              <p style={{ color: '#64748b', fontSize: '0.83rem', margin: '4px 0 0' }}>Official Digital Receipt & Tax Invoice</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.88rem', color: '#334155', marginBottom: '18px' }}>
              <div><strong>Customer:</strong> {selectedInvoice.name}</div>
              <div><strong>Order ID:</strong> #{String(selectedInvoice._id).slice(-8)}</div>
              <div><strong>Date:</strong> {new Date(selectedInvoice.createdAt || Date.now()).toLocaleDateString()}</div>
              <div><strong>Status:</strong> <span style={{ color: '#2e7d32', fontWeight: '700' }}>{selectedInvoice.status || 'Pending'}</span></div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '18px' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px', textAlign: 'left' }}>Item</th>
                  <th style={{ padding: '8px', textAlign: 'center' }}>Qty</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {selectedInvoice.items?.length > 0
                  ? selectedInvoice.items.map((i, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
                      <td style={{ padding: '9px 8px' }}>{i.name}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'center' }}>{i.quantity}</td>
                      <td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: '600' }}>₹{i.price * i.quantity}</td>
                    </tr>
                  ))
                  : <tr><td style={{ padding: '9px 8px' }}>{selectedInvoice.item}</td><td style={{ padding: '9px 8px', textAlign: 'center' }}>{selectedInvoice.quantity || 1}</td><td style={{ padding: '9px 8px', textAlign: 'right', fontWeight: '600' }}>₹{selectedInvoice.price}</td></tr>
                }
              </tbody>
            </table>
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', textAlign: 'right', fontSize: '0.88rem', marginBottom: '20px' }}>
              <div>Subtotal: ₹{selectedInvoice.subtotal || selectedInvoice.price}</div>
              <div>GST (5%): ₹{selectedInvoice.tax || 0}</div>
              <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#2e7d32', marginTop: '6px' }}>Grand Total: ₹{selectedInvoice.grandTotal || selectedInvoice.price}</div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-green" style={{ flex: 1 }} onClick={() => window.print()}><Printer size={16} /> Print / Save</button>
              <button style={{ background: '#e2e8f0', border: 'none', borderRadius: '10px', padding: '10px 18px', cursor: 'pointer', fontWeight: '600' }} onClick={() => setSelectedInvoice(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 16px', borderRadius: '20px', border: 'none', background: active ? '#2e7d32' : '#f1f5f9', color: active ? 'white' : '#334155', cursor: 'pointer', fontWeight: '600', fontSize: '0.88rem' }}>
      {label}
    </button>
  );
}

function StatCard({ label, value, color, bg }) {
  return (
    <div style={{ background: bg, padding: '18px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
      <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: '600' }}>{label}</span>
      <h3 style={{ fontSize: '1.6rem', color, fontWeight: '800', margin: '4px 0 0' }}>{value}</h3>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = { Pending: { bg: '#fef3c7', color: '#d97706' }, Preparing: { bg: '#dbeafe', color: '#2563eb' }, Completed: { bg: '#dcfce7', color: '#15803d' }, Cancelled: { bg: '#fee2e2', color: '#dc2626' } };
  const c = colors[status] || { bg: '#f1f5f9', color: '#64748b' };
  return <span style={{ background: c.bg, color: c.color, padding: '3px 10px', borderRadius: '20px', fontWeight: '700', fontSize: '0.78rem' }}>{status}</span>;
}

function OrderCard({ order, onViewBill, onCancelOrder, onReorder }) {
  const steps = ['Order Placed', 'Kitchen Preparing', 'Ready / Served'];
  const isCancelled = order.status === 'Cancelled';
  const stepIdx = order.status === 'Preparing' ? 1 : order.status === 'Completed' ? 2 : 0;
  return (
    <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Order #{String(order._id).slice(-8)} • {new Date(order.createdAt || Date.now()).toLocaleString()}</div>
          <h3 style={{ fontWeight: '700', color: '#1e293b', fontSize: '1rem', marginTop: '2px' }}>
            {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ') || `${order.item} ×${order.quantity}`}
          </h3>
          <span style={{ color: '#2e7d32', fontWeight: '700' }}>₹{order.grandTotal || order.price}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <StatusBadge status={order.status || 'Pending'} />
          <button onClick={onViewBill} style={{ background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
            <Receipt size={14} /> View Bill
          </button>
          {(order.status === 'Pending' || !order.status) && (
            <button onClick={onCancelOrder} style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
              <XCircle size={14} /> Cancel Order
            </button>
          )}
          {onReorder && (
            <button onClick={onReorder} style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '7px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}>
              <RefreshCw size={14} /> Re-Order
            </button>
          )}
        </div>
      </div>
      {!isCancelled ? (
        <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px' }}>
          {steps.map((step, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '0.8rem', background: i <= stepIdx ? '#2e7d32' : '#e2e8f0', color: i <= stepIdx ? 'white' : '#94a3b8' }}>{i + 1}</div>
                <span style={{ fontSize: '0.72rem', fontWeight: '600', color: '#334155', whiteSpace: 'nowrap' }}>{step}</span>
              </div>
              {i < steps.length - 1 && <div style={{ flex: 1, height: '2px', background: i < stepIdx ? '#2e7d32' : '#e2e8f0', margin: '0 6px', marginBottom: '18px' }} />}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: '10px', color: '#b91c1c', fontSize: '0.85rem', fontWeight: '600' }}>
          ⚠️ This order was cancelled.
        </div>
      )}
    </div>
  );
}

function BillRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', marginBottom: '6px', fontSize: '0.92rem' }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
