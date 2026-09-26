const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Read API key from environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

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

// Helper: Call Google Gemini Live AI
async function callGeminiAI(userPrompt, restaurantCatalog, groceryCatalog) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstruction = `
You are the Providr AI Super-App Concierge.
The user will express their cravings, dietary needs, or plans.
Select the BEST single item from the Restaurant Catalog and the BEST single item from the Grocery Catalog to create an intelligent bundle.

Restaurant Catalog:
${JSON.stringify(restaurantCatalog)}

Grocery Catalog:
${JSON.stringify(groceryCatalog)}

Respond ONLY with a valid JSON object in this exact schema (no markdown, no backticks):
{
  "restaurantItemId": "id of chosen restaurant item",
  "groceryItemId": "id of chosen grocery item",
  "aiReasoning": "1-2 concise sentences explaining why you picked this combination for the user."
}
`;

  const payload = {
    contents: [
      {
        parts: [
          { text: systemInstruction },
          { text: `User Request: "${userPrompt}"` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(textOutput);
}

// AI Intent Bundle Endpoint
app.post('/api/bundle', async (req, res) => {
  const { query, userId } = req.body;
  const rawText = query || '';

  const pizzeria = merchantsDB.find((m) => m.id === 'm_pizzeria');
  const grocery = merchantsDB.find((m) => m.id === 'm_grocery');

  let matchedPizza = pizzeria.catalog.find((p) => p.id === 'bp_2') || pizzeria.catalog[0];
  let matchedGrocery = grocery.catalog.find((g) => g.id === 'qh_1') || grocery.catalog[0];
  let aiReasoning = 'Paired based on high-affinity dinner and household staple pattern.';

  // If Gemini API Key is available, use real AI
  if (GEMINI_API_KEY) {
    try {
      const aiResult = await callGeminiAI(rawText, pizzeria.catalog, grocery.catalog);
      const foundPizza = pizzeria.catalog.find((p) => p.id === aiResult.restaurantItemId);
      const foundGrocery = grocery.catalog.find((g) => g.id === aiResult.groceryItemId);

      if (foundPizza) matchedPizza = foundPizza;
      if (foundGrocery) matchedGrocery = foundGrocery;
      if (aiResult.aiReasoning) aiReasoning = aiResult.aiReasoning;
    } catch (err) {
      console.error('Gemini API call failed, falling back to local engine:', err.message);
    }
  } else {
    // Local fallback matching
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