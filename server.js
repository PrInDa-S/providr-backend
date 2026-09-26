const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

// Virtual Household Pantry
const pantryInventoryDB = {
  user_123: [
    { itemId: 'p1', name: 'All-Purpose Flour', quantity: '500g', status: 'sufficient' },
    { itemId: 'p2', name: 'Refined Sugar', quantity: '1kg', status: 'sufficient' },
    { itemId: 'p3', name: 'Olive Oil', quantity: '200ml', status: 'low' },
    { itemId: 'p4', name: 'Whole Milk', quantity: '0ml', status: 'out_of_stock' },
    { itemId: 'p5', name: 'Farm Fresh Eggs', quantity: '2 units', status: 'low' },
    { itemId: 'p6', name: 'Sparkling Soda', quantity: '0 cans', status: 'out_of_stock' },
  ],
};

// Merchants Catalog
const merchantsDB = [
  {
    id: 'm_pizzeria',
    name: 'Bella Napoli Woodfired Pizza',
    type: 'restaurant',
    prepTimeMinutes: 16,
    catalog: [
      { id: 'bp_1', name: 'Margherita Pizza 12"', price: 10.50, tags: ['vegetarian', 'cheese'] },
      { id: 'bp_2', name: 'Diavola Pepperoni Pizza 12"', price: 12.50, tags: ['spicy', 'meat'] },
      { id: 'bp_3', name: 'Quattro Formaggi 12"', price: 13.00, tags: ['vegetarian', 'cheese'] },
    ],
  },
  {
    id: 'm_grocery',
    name: 'QuickHub Local Essentials',
    type: 'grocery',
    prepTimeMinutes: 4,
    catalog: [
      { id: 'qh_1', name: 'Bio Whole Milk (1L)', price: 1.79 },
      { id: 'qh_2', name: 'Organic Pancake Mix (400g)', price: 3.29 },
      { id: 'qh_3', name: 'Pure Maple Syrup (250ml)', price: 4.99 },
      { id: 'qh_4', name: 'Sparkling Mineral Water (1L)', price: 0.99 },
      { id: 'qh_5', name: 'Farm Fresh Eggs (6-Pack)', price: 2.49 },
      { id: 'qh_6', name: 'Artisan Gelato Tub (500ml)', price: 5.50 },
    ],
  },
];

const ordersDB = [];

// Endpoint: Pantry Inventory
app.get('/api/pantry/:userId', (req, res) => {
  const { userId } = req.params;
  const items = pantryInventoryDB[userId] || [];
  return res.status(200).json({
    userId,
    items,
    lowOrOut: items.filter((i) => i.status === 'low' || i.status === 'out_of_stock'),
  });
});

// AI Intent Bundle Parser
app.post('/api/bundle', (req, res) => {
  const { query, userId } = req.body;
  const rawText = (query || '').toLowerCase();

  const pizzeria = merchantsDB.find((m) => m.id === 'm_pizzeria');
  const grocery = merchantsDB.find((m) => m.id === 'm_grocery');

  // Defaults: Pepperoni Pizza & Milk
  let matchedPizza = pizzeria.catalog.find((p) => p.id === 'bp_2') || pizzeria.catalog[0];
  let matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_1') || grocery.catalog[0];
  let aiReasoning = 'Paired based on dinner preference and household staples.';

  // Vegetarian / Meatless detection
  if (rawText.includes('veg') || rawText.includes('no meat') || rawText.includes('cheese')) {
    matchedPizza = pizzeria.catalog.find((p) => p.id === 'bp_1') || matchedPizza;
    aiReasoning = 'Vegetarian preference detected: Selected Margherita 12".';
  }

  // Dessert / Specific Grocery detection
  if (rawText.includes('dessert') || rawText.includes('sweet') || rawText.includes('ice cream') || rawText.includes('gelato')) {
    matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_6') || matchedGrocery;
    aiReasoning += ' Added Artisan Gelato Tub for dessert.';
  } else if (rawText.includes('pancake') || rawText.includes('breakfast')) {
    matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_2') || matchedGrocery;
    aiReasoning += ' Added Organic Pancake Mix.';
  } else if (rawText.includes('egg') || rawText.includes('protein')) {
    matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_5') || matchedGrocery;
    aiReasoning += ' Added Fresh Eggs.';
  } else if (rawText.includes('water') || rawText.includes('drink') || rawText.includes('soda')) {
    matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_4') || matchedGrocery;
    aiReasoning += ' Paired with chilled Sparkling Mineral Water.';
  }

  const bundlePrice = Number((matchedPizza.price + matchedGrocery.price).toFixed(2));

  const bundle = {
    restaurantItem: {
      id: matchedPizza.id,
      name: matchedPizza.name,
      merchant: pizzeria.name,
      price: matchedPizza.price,
    },
    groceryItem: {
      id: matchedGrocery.id,
      name: matchedGrocery.name,
      merchant: grocery.name,
      price: matchedGrocery.price,
    },
    bundlePrice: bundlePrice,
    aiReasoning: aiReasoning,
  };

  return res.status(200).json({
    queryReceived: query,
    userId,
    suggestion: bundle,
  });
});

// Endpoint: Place Order
app.post('/api/orders', (req, res) => {
  const { userId, items, deliveryAddress, totalAmount } = req.body;
  if (!items || !items.length) {
    return res.status(400).json({ error: 'Cart is empty.' });
  }

  const orderId = `ORD-${Date.now()}`;
  const newOrder = {
    orderId,
    userId,
    items,
    deliveryAddress: deliveryAddress || 'Customer Address',
    totalAmount,
    status: 'DISPATCHED_TO_MERCHANTS',
    createdAt: new Date().toISOString(),
  };

  ordersDB.push(newOrder);

  return res.status(201).json({
    message: 'Order accepted and dispatched for multi-merchant fulfillment.',
    orderId: newOrder.orderId,
    status: newOrder.status,
    estimatedArrival: '28 minutes',
  });
});

app.listen(PORT, () => {
  console.log(`Providr backend running on port ${PORT}`);
});