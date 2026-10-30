const { supabase } = require('../db/supabase');

function formatOrderRow(row) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name || 'Guest',
    email: row.email || '',
    mobile: row.mobile || '',
    item: row.item || '',
    quantity: Number(row.quantity) || 1,
    price: Number(row.price) || 0,
    items: Array.isArray(row.items) ? row.items : [],
    subtotal: Number(row.subtotal) || 0,
    tax: Number(row.tax) || 0,
    grandTotal: Number(row.grand_total) || Number(row.grandTotal) || 0,
    grand_total: Number(row.grand_total) || Number(row.grandTotal) || 0,
    status: row.status || 'Pending',
    createdAt: row.created_at,
    created_at: row.created_at,
    updatedAt: row.updated_at,
    updated_at: row.updated_at,
  };
}

class Order {
  constructor(data) {
    this.id = data.id || data._id || ('ORD' + Date.now().toString().slice(-6));
    this._id = this.id;
    this.name = data.name || 'Guest';
    this.email = data.email || '';
    this.mobile = data.mobile || '';
    this.items = data.items || [];
    this.item = data.item || (this.items.length > 0 ? this.items[0].name : 'Breakfast Meal');
    this.quantity = data.quantity || (this.items.length > 0 ? this.items[0].quantity : 1);
    this.price = Number(data.price) || 0;
    this.subtotal = Number(data.subtotal) || 0;
    this.tax = Number(data.tax) || 0;
    this.grandTotal = Number(data.grandTotal || data.grand_total || this.price);
    this.grand_total = this.grandTotal;
    this.status = data.status || 'Pending';
    this.created_at = data.created_at || data.createdAt || new Date();
    this.createdAt = this.created_at;
  }

  async save() {
    const payload = {
      id: this.id,
      name: this.name,
      email: this.email,
      mobile: this.mobile,
      item: this.item,
      quantity: this.quantity,
      price: this.price,
      items: this.items,
      subtotal: this.subtotal,
      tax: this.tax,
      grand_total: this.grandTotal,
      status: this.status,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('orders')
      .upsert(payload)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return formatOrderRow(data);
  }

  static async find(filter = {}) {
    let q = supabase.from('orders').select('*').order('created_at', { ascending: false });

    if (filter.status) {
      q = q.eq('status', filter.status);
    }
    if (filter.name) {
      const name = typeof filter.name === 'string' ? filter.name : (filter.name.source || String(filter.name));
      const clean = name.replace(/^[\^]/, '').replace(/[\$]/, '');
      q = q.ilike('name', `%${clean}%`);
    }
    if (filter.search) {
      q = q.or(`name.ilike.%${filter.search}%,email.ilike.%${filter.search}%`);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(formatOrderRow);
  }

  static async findById(id) {
    const { data, error } = await supabase.from('orders').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return formatOrderRow(data);
  }

  static async findByIdAndUpdate(id, updates = {}) {
    const payload = {};
    if (updates.status !== undefined) payload.status = updates.status;
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.items !== undefined) payload.items = updates.items;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('orders')
      .update(payload)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (error) throw new Error(error.message);
    return formatOrderRow(data);
  }
}

module.exports = Order;
