const bcrypt = require('bcryptjs');
const { supabase } = require('../db/supabase');

class User {
  constructor(data) {
    this.id = data.id || data._id;
    this._id = this.id;
    this.name = (data.name || '').trim();
    this.email = (data.email || '').toLowerCase().trim();
    this.password = data.password;
    this.mobile = data.mobile || '';
    this.role = data.role || 'user';
    this.created_at = data.created_at || data.createdAt || new Date();
    this.createdAt = this.created_at;
  }

  async comparePassword(plain) {
    if (!this.password || !plain) return false;
    return bcrypt.compare(plain, this.password);
  }

  async save() {
    if (!this.password.startsWith('$2a$') && !this.password.startsWith('$2b$')) {
      this.password = await bcrypt.hash(this.password, 10);
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        name: this.name,
        email: this.email,
        password: this.password,
        mobile: this.mobile,
        role: this.role,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        const err = new Error('Email already registered.');
        err.code = 11000;
        throw err;
      }
      throw new Error(error.message);
    }

    this.id = data.id;
    this._id = data.id;
    this.created_at = data.created_at;
    this.createdAt = data.created_at;
    return this;
  }

  static async findOne(query = {}) {
    let q = supabase.from('users').select('*');

    if (query.email) {
      const email = typeof query.email === 'string' ? query.email.toLowerCase().trim() : query.email;
      q = q.ilike('email', email);
    } else if (query.name) {
      const name = typeof query.name === 'string' ? query.name.trim() : query.name.source || query.name;
      const cleanName = String(name).replace(/^[\^]/, '').replace(/[\$]$/, '');
      q = q.ilike('name', cleanName);
    } else if (query._id || query.id) {
      q = q.eq('id', query._id || query.id);
    }

    const { data, error } = await q.maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return new User(data);
  }

  static async findById(id) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return new User(data);
  }

  static async find(query = {}, projection = {}) {
    let q = supabase.from('users').select('*').order('created_at', { ascending: false });

    if (query.role) {
      q = q.eq('role', query.role);
    }

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return (data || []).map(row => {
      const user = new User(row);
      if (projection && projection.password === 0) {
        delete user.password;
      }
      return user;
    });
  }

  static async create(userData) {
    const user = new User(userData);
    return user.save();
  }
}

module.exports = User;
