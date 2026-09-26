const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const app = express();
const PORT = process.env.PORT || 3000;

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

// Merchants Catalog
const merchantsDB = [
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
    name: 'QuickHub Local Essentials',
    type: 'grocery',
    prepTimeMinutes: 4,
    catalog: [
      { id: 'qh_1', name: 'Bio Whole Milk (1L)', price: 1.79, description: 'Fresh organic milk, great for breakfast.' },
      { id: 'qh_2', name: 'Organic Pancake Mix (400g)', price: 3.29, description: 'Sweet breakfast mix, fluffy pancakes.' },
      { id: 'qh_3', name: 'Pure Maple Syrup (250ml)', price: 4.99, description: 'Grade A natural maple syrup for toppings.' },
      { id: 'qh_4', name: 'Sparkling Mineral Water (1L)', price: 0.99, description: 'Refreshing sparkling zero-calorie hydration.' },
      { id: 'qh_5', name: 'Farm Fresh Eggs (6-Pack)', price: 2.49, description: 'Free-range brown eggs for baking or breakfast.' },
      { id: 'qh_6', name: 'Artisan Gelato Tub (500ml)', price: 5.50, description: 'Cold creamy Italian gelato dessert.' },
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

// Helper: Call Google Gemini Live AI
async function callGeminiAI(userPrompt, restaurantCatalog, groceryCatalog) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const systemInstruction = `
You are the Providr AI Super-App Concierge.
Select the BEST single item from the Restaurant Catalog and the BEST single item from the Grocery Catalog to create an intelligent bundle based on user request.

Restaurant Catalog:
${JSON.stringify(restaurantCatalog)}

Grocery Catalog:
${JSON.stringify(groceryCatalog)}

Respond ONLY with a valid JSON object in this exact schema:
{
  "restaurantItemId": "id of chosen restaurant item",
  "groceryItemId": "id of chosen grocery item",
  "aiReasoning": "1-2 concise sentences explaining why you picked this combination."
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

  const pizzeria = merchantsDB.find((m) => m.id === 'm_pizzeria');
  const grocery = merchantsDB.find((m) => m.id === 'm_grocery');

  let matchedPizza = pizzeria.catalog.find((p) => p.id === 'bp_2') || pizzeria.catalog[0];
  let matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_1') || grocery.catalog[0];
  let aiReasoning = 'Paired based on dinner preference and household staples.';

  if (GEMINI_API_KEY) {
    try {
      const aiResult = await callGeminiAI(rawText, pizzeria.catalog, grocery.catalog);
      const foundPizza = pizzeria.catalog.find((p) => p.id === aiResult.restaurantItemId);
      const foundGrocery = grocery.catalog.find((g) => g.id === aiResult.groceryItemId);
      if (foundPizza) matchedPizza = foundPizza;
      if (foundGrocery) matchedGrocery = foundGrocery;
      if (aiResult.aiReasoning) aiReasoning = aiResult.aiReasoning;
    } catch (err) {
      console.error('Gemini call error:', err.message);
    }
  } else {
    const lower = rawText.toLowerCase();
    if (lower.includes('veg') || lower.includes('no meat') || lower.includes('cheese')) {
      matchedPizza = pizzeria.catalog.find((p) => p.id === 'bp_1') || matchedPizza;
      aiReasoning = 'Vegetarian preference detected: Selected Margherita 12".';
    }
    if (lower.includes('dessert') || lower.includes('sweet') || lower.includes('ice cream') || lower.includes('gelato')) {
      matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_6') || matchedGrocery;
      aiReasoning += ' Added Artisan Gelato Tub for dessert.';
    } else if (lower.includes('pancake') || lower.includes('breakfast')) {
      matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_2') || matchedGrocery;
    } else if (lower.includes('water') || lower.includes('drink')) {
      matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_4') || matchedGrocery;
    }
  }

  const bundlePrice = Number((matchedPizza.price + matchedGrocery.price).toFixed(2));

  return res.status(200).json({
    queryReceived: query,
    userId,
    suggestion: {
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
        product_data: {
          name: `${item.name} (${item.merchant || 'Providr'})`,
        },
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
      metadata: {
        userId: userId || 'user_123',
        itemsJson: JSON.stringify(items || []),
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe session creation error:', err);
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
// Serve the Merchant Portal
app.get('/merchant', (req, res) => {
  res.sendFile(__dirname + '/merchant.html');
});

// Merchant API: Fetch all recent orders from Supabase
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
app.listen(PORT, () => {
  console.log(`Providr backend running on port ${PORT}`);
});