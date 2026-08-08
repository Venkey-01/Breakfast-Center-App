const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
  id:       String,
  name:     String,
  price:    Number,
  quantity: Number,
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  name:       { type: String, default: 'Guest' },
  email:      { type: String, default: '' },
  mobile:     { type: String, default: '' },
  item:       { type: String, default: '' },
  quantity:   { type: Number, default: 1 },
  price:      { type: Number, default: 0 },
  items:      { type: [ItemSchema], default: [] },
  subtotal:   { type: Number, default: 0 },
  tax:        { type: Number, default: 0 },
  grandTotal: { type: Number, default: 0 },
  status:     { type: String, enum: ['Pending', 'Preparing', 'Completed', 'Cancelled'], default: 'Pending' },
}, { timestamps: true });

module.exports = mongoose.model('Order', OrderSchema);
