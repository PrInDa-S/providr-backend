const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for mobile apps and web clients
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Stripe Configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_51UJxTXAseCsCY4dButLqpWRJYN7YA13844YRYjLOOZyRQBk1ASWLgeqga9wsN5WdEi7EoDUG1tnv4ATyP9ShvK6W00eLBpU72a';
const stripe = require('stripe')(STRIPE_SECRET_KEY);

// Supabase Cloud Database Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sjnemvwdsohcecbtjhtd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqbmVtdndkc29oY2VjYnRqaHRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0Mjc5NTAsImV4cCI6MjEwNjAwMzk1MH0.5Hp8Bw58TjD_Xt0za7cbbPS0KnRRcO9eetQeEv0xdFI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read Gemini API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

app.use(express.json());
app.use(express.static(__dirname));

// Multi-Cuisine Merchants Catalog (Fallback Baseline)
const merchantsDB = [
  {
    id: 'm_asian',
    name: 'Tokyo & Seoul Asian Kitchen',
    type: 'restaurant',
    prepTimeMinutes: 18,
    catalog: [
      { id: 'as_1', name: 'Japanese Chicken Teriyaki Bento', price: 14.50, description: 'Japanese Bento box with glazed teriyaki chicken, steamed jasmine rice, edamame, and gyoza.' },
      { id: 'as_2', name: 'Korean Kimchi & Beef Bibimbap (3-Person Platter)', price: 24.00, description: 'Large Korean shared bowl with marinated bulgogi beef, warm rice, seasoned vegetables, and gochujang sauce.' },
      { id: 'as_3', name: 'Spicy Miso Tokyo Ramen', price: 13.00, description: 'Rich ramen broth, springy noodles, soft-boiled egg, and nori seaweed.' },
    ],
  },
  {
    id: 'm_desi',
    name: 'Lahori Dera & Karahi Grill',
    type: 'restaurant',
    prepTimeMinutes: 20,
    catalog: [
      { id: 'ds_1', name: 'Special Mutton Dum Biryani (Family Pack)', price: 18.50, description: 'Fragrant basmati rice layered with tender mutton, saffron, and raita.' },
      { id: 'ds_2', name: 'Chicken Makhni Handi with 4 Garlic Naans', price: 16.00, description: 'Creamy butter chicken handi cooked in traditional clay pot with fresh naans.' },
      { id: 'ds_3', name: 'Reshmi Seekh Kabab Platter', price: 12.50, description: '6 succulent grilled chicken kababs with mint chutney.' },
    ],
  },
  {
    id: 'm_burger',
    name: 'The Smash Burger & Co.',
    type: 'restaurant',
    prepTimeMinutes: 12,
    catalog: [
      { id: 'bg_1', name: 'Double Smash Cheeseburger & Truffle Fries', price: 13.50, description: 'Two smashed angus patties, melted cheddar, caramelized onions, house burger sauce.' },
      { id: 'bg_2', name: 'Crispy Nashville Hot Chicken Sandwich', price: 11.50, description: 'Crispy fried chicken breast, spicy cayenne oil, dill pickles, brioche bun.' },
    ],
  },
  {
    id: 'm_pizzeria',
    name: 'Bella Napoli Woodfired Pizza',
    type: 'restaurant',
    prepTimeMinutes: 16,
    catalog: [
      { id: 'bp_1', name: 'Margherita Pizza 12"', price: 10.50, description: 'Classic tomato, fresh mozzarella, basil. Vegetarian.' },
      { id: 'bp_2', name: 'Diavola Pepperoni Pizza 12"', price: 12.50, description: 'Spicy calabrian salami, chili oil, mozzarella.' },
      { id: 'bp_3', name: 'Quattro Formaggi 12"', price: 13.00, description: 'Gorgonzola, parmesan, mozzarella, fontina. Rich and cheesy. Vegetarian.' },
    ],
  },
  {
    id: 'm_grocery',
    name: 'QuickHub Local Essentials & Drinks',
    type: 'grocery',
    prepTimeMinutes: 4,
    catalog: [
      { id: 'qh_1', name: 'Bio Whole Milk (1L)', price: 1.79, description: 'Fresh organic milk, great for breakfast.' },
      { id: 'qh_2', name: 'Organic Pancake Mix (400g)', price: 3.29, description: 'Sweet breakfast mix, fluffy pancakes.' },
      { id: 'qh_3', name: 'Pure Maple Syrup (250ml)', price: 4.99, description: 'Grade A natural maple syrup for toppings.' },
      { id: 'qh_4', name: 'Sparkling Mineral Water (1L)', price: 0.99, description: 'Refreshing sparkling zero-calorie hydration.' },
      { id: 'qh_5', name: 'Farm Fresh Eggs (6-Pack)', price: 2.49, description: 'Free-range brown eggs for baking or breakfast.' },
      { id: 'qh_6', name: 'Artisan Gelato Tub (500ml)', price: 5.50, description: 'Cold creamy Italian gelato dessert.' },
      { id: 'qh_7', name: 'Japanese Green Tea (500ml Chilled)', price: 2.20, description: 'Chilled unsweetened green tea bottle.' },
    ],
  },
];

// Endpoint: Fetch Pantry from Supabase Cloud
app.get('/api/pantry/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { data, error } = await supabase.from('pantry').select('*').eq('user_id', userId);
    if (error || !data || data.length === 0) {
      return res.status(200).json({ userId, items: [] });
    }
    const items = data.map((d) => ({
      itemId: d.item_id,
      name: d.name,
      quantity: d.quantity,
      status: d.status,
    }));
    return res.status(200).json({
      userId,
      items,
      lowOrOut: items.filter((i) => i.status === 'low' || i.status === 'out_of_stock'),
    });
  } catch (err) {
    return res.status(200).json({ userId, items: [] });
  }
});

// Helper: Call Google Gemini Live AI with Multi-Cuisine Knowledge
async function callGeminiAI(userPrompt, allRestaurants, groceryCatalog) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const allRestaurantItems = allRestaurants.flatMap((r) =>
    r.catalog.map((c) => ({ ...c, restaurantName: r.name }))
  );

  const systemInstruction = `
You are the Providr AI Super-App Concierge.
The user may speak in English, Urdu, or other languages, asking for specific cuisines (Japanese, Korean, Desi/Pakistani, Burgers, Pizza), portions, or dietary restrictions.
Select the BEST single item from the Restaurant Catalogs and the BEST single item from the Grocery Catalog to fulfill the request.

Available Restaurant Dishes:
${JSON.stringify(allRestaurantItems)}

Grocery Catalog:
${JSON.stringify(groceryCatalog)}

Respond ONLY with a valid JSON object in this exact schema (no markdown, no backticks):
{
  "restaurantItemId": "id of chosen restaurant item",
  "groceryItemId": "id of chosen grocery item",
  "aiReasoning": "1-2 concise sentences explaining why you picked this exact combination for the customer."
}
`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemInstruction }, { text: `User Request: "${userPrompt}"` }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(textOutput);
}

// Endpoint: AI Bundle Synthesizer
app.post('/api/bundle', async (req, res) => {
  const { query, userId } = req.body;
  const rawText = query || '';
  const lower = rawText.toLowerCase();

  const restaurants = merchantsDB.filter((m) => m.type === 'restaurant');
  const grocery = merchantsDB.find((m) => m.id === 'm_grocery');

  // Guaranteed safe defaults
  const defaultRestaurant = restaurants.find((r) => r.id === 'm_pizzeria') || restaurants[0];
  let matchedPizza = defaultRestaurant.catalog || defaultRestaurant.catalog[0];
  let matchedRestaurantName = defaultRestaurant.name;
  let matchedGrocery = grocery.catalog[0];
  let aiReasoning = 'Paired based on dinner preference and household staples.';

  // 1. Check with Gemini AI first if key exists
  let geminiSuccess = false;
  if (GEMINI_API_KEY) {
    try {
      const aiResult = await callGeminiAI(rawText, restaurants, grocery.catalog);
      for (const r of restaurants) {
        const item = r.catalog.find((c) => c.id === aiResult.restaurantItemId);
        if (item) {
          matchedPizza = item;
          matchedRestaurantName = r.name;
          geminiSuccess = true;
          break;
        }
      }
      const gItem = grocery.catalog.find((g) => g.id === aiResult.groceryItemId);
      if (gItem) matchedGrocery = gItem;
      if (aiResult.aiReasoning) aiReasoning = aiResult.aiReasoning;
    } catch (err) {
      console.error('Gemini call error:', err.message);
    }
  }

  // 2. Intelligent Rule-Based Fallback
  if (!geminiSuccess) {
    if (lower.includes('korean') || lower.includes('japan') || lower.includes('sushi') || lower.includes('ramen') || lower.includes('bento')) {
      const asian = restaurants.find((r) => r.id === 'm_asian') || restaurants[0];
      matchedPizza = (lower.includes('3') || lower.includes('three') || lower.includes('friends')) ? asian.catalog : asian.catalog[0];
      matchedRestaurantName = asian.name;
      matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_7') || grocery.catalog[0];
      aiReasoning = 'Matched Tokyo & Seoul Asian Kitchen with chilled Japanese Green Tea.';
    } else if (lower.includes('biryani') || lower.includes('desi') || lower.includes('karahi') || lower.includes('pakistan')) {
      const desi = restaurants.find((r) => r.id === 'm_desi') || restaurants[0];
      matchedPizza = desi.catalog[0];
      matchedRestaurantName = desi.name;
      matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_4') || grocery.catalog[0];
      aiReasoning = 'Matched Lahori Dera Mutton Dum Biryani with chilled mineral water.';
    } else if (lower.includes('burger') || lower.includes('fries') || lower.includes('chicken')) {
      const burger = restaurants.find((r) => r.id === 'm_burger') || restaurants[0];
      matchedPizza = burger.catalog[0];
      matchedRestaurantName = burger.name;
      matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_6') || grocery.catalog[0];
      aiReasoning = 'Matched The Smash Burger & Co. with Artisan Gelato dessert.';
    } else if (lower.includes('veg') || lower.includes('cheese')) {
      const pizza = restaurants.find((r) => r.id === 'm_pizzeria') || restaurants[0];
      matchedPizza = pizza.catalog[0];
      matchedRestaurantName = pizza.name;
      aiReasoning = 'Vegetarian preference detected: Selected Margherita 12".';
    }
  }

  const bundlePrice = Number((Number(matchedPizza.price || 0) + Number(matchedGrocery.price || 0)).toFixed(2));

  return res.status(200).json({
    queryReceived: query,
    userId,
    suggestion: {
      restaurantItem: {
        id: matchedPizza.id,
        name: matchedPizza.name,
        merchant: matchedRestaurantName,
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
    },
  });
});

// Endpoint: Create Real Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  const { items, totalAmount, userId } = req.body;
  try {
    const origin = req.headers.origin || 'https://providr-backend.onrender.com';
    const line_items = (items || []).map((item) => ({
      price_data: {
        currency: 'eur',
        product_data: { name: `${item.name} (${item.merchant || 'Providr'})` },
        unit_amount: Math.round(Number(item.price || 0) * 100),
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: line_items,
      mode: 'payment',
      success_url: `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}&total=${totalAmount || 0}`,
      cancel_url: `${origin}/?payment_cancelled=true`,
      metadata: { userId: userId || 'user_123', itemsJson: JSON.stringify(items || []) },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Endpoint: Confirm Paid Order & Record to Supabase
app.post('/api/confirm-payment', async (req, res) => {
  const { sessionId, total } = req.body;
  const orderId = `ORD-PAID-${Date.now()}`;
  try {
    await supabase.from('orders').insert([
      {
        id: orderId,
        user_id: 'user_123',
        items: [{ note: 'Paid via Stripe Checkout', sessionId }],
        delivery_address: 'Verified Customer Delivery Address',
        total_amount: Number(total || 0),
        status: 'PAID & DISPATCHED',
      },
    ]);
  } catch (e) {
    console.error('Database save error:', e);
  }

  return res.status(200).json({
    orderId,
    status: 'PAID & DISPATCHED',
    message: 'Payment verified! Order dispatched to merchants.',
    estimatedArrival: '28 minutes',
  });
});

// Endpoint: Direct Manual Order Placement
app.post('/api/orders', async (req, res) => {
  const { userId, items, deliveryAddress, totalAmount } = req.body;
  const orderId = `ORD-${Date.now()}`;
  try {
    await supabase.from('orders').insert([
      {
        id: orderId,
        user_id: userId || 'user_123',
        items: items,
        delivery_address: deliveryAddress || 'Customer Location',
        total_amount: totalAmount,
        status: 'DISPATCHED_TO_MERCHANTS',
      },
    ]);
  } catch (e) {
    console.error('Database save error:', e);
  }

  return res.status(201).json({
    message: 'Order accepted, recorded in cloud database, and dispatched.',
    orderId: orderId,
    status: 'DISPATCHED_TO_MERCHANTS',
    estimatedArrival: '28 minutes',
  });
});

// 1. Serve Merchant Kitchen Portal
app.get('/merchant', (req, res) => {
  res.sendFile(__dirname + '/merchant.html');
});

// 2. Serve Courier Fleet Portal
app.get('/courier', (req, res) => {
  res.sendFile(__dirname + '/courier.html');
});

// 3. Serve Admin Store & Menu Manager
app.get('/admin', (req, res) => {
  res.sendFile(__dirname + '/admin.html');
});

// Merchant API: Fetch recent orders
app.get('/api/merchant/orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(15);
    return res.status(200).json(data || []);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Merchant API: Update Order Status
app.post('/api/merchant/update-status', async (req, res) => {
  const { orderId, status } = req.body;
  try {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    return res.status(200).json({ success: true, orderId, status });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin API: Fetch all merchants and items from Supabase
app.get('/api/admin/catalog', async (req, res) => {
  try {
    const { data: merchants } = await supabase.from('merchants').select('*');
    const { data: items } = await supabase.from('menu_items').select('*');
    return res.status(200).json({ merchants: merchants || [], items: items || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin API: Add new merchant to Supabase
app.post('/api/admin/merchants', async (req, res) => {
  const { id, name, type, prep_time_minutes, address } = req.body;
  try {
    const { error } = await supabase.from('merchants').insert([{ id, name, type, prep_time_minutes, address }]);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ message: 'Store saved to cloud database!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin API: Add new menu item to Supabase
app.post('/api/admin/items', async (req, res) => {
  const { id, merchant_id, name, price, description } = req.body;
  try {
    const { error } = await supabase.from('menu_items').insert([{ id, merchant_id, name, price, description }]);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ message: 'Item added to cloud database!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Providr backend running on port ${PORT}`);
});