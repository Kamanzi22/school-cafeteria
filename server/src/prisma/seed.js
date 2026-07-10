const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('\n🌱 Seeding CaféCampus v3...\n');

  // Clean
  await prisma.orderItem.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.favorite.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuCategory.deleteMany();
  await prisma.restaurantStaff.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.superAdmin.deleteMany();

  const hash12 = (pw) => bcrypt.hash(pw, 12);

  // ── Super Admin ────────────────────────────────────────────
  await prisma.superAdmin.create({ data: { username: 'superadmin', passwordHash: await hash12('super123') } });
  console.log('✅ Super Admin: username=superadmin, password=super123');

  // ── Demo Restaurants (pre-registered so app works out of box) ─
  const restaurants = [
    { ownerName:'Amina Uwase', ownerEmail:'amina@mamaafrica.rw', name:'Mama Africa Kitchen', slug:'mama-africa', emoji:'🍲', coverColor:'#d97706', category:'African', description:'Authentic African cuisine — stews, rice dishes & local favourites made fresh every morning.', location:'Main Hall', floor:'Ground Floor', phone:'+250 78 100 0001', prepTimeMin:12, prepTimeMax:20, openTime:'07:00', closeTime:'17:30', isOpen:true },
    { ownerName:'James Okonkwo', ownerEmail:'james@burgerspot.rw', name:'The Burger Spot', slug:'burger-spot', emoji:'🍔', coverColor:'#dc2626', category:'Fast Food', description:'Smashed-to-order burgers, loaded fries and thick shakes — campus comfort at its finest.', location:'Food Court', floor:'Ground Floor', phone:'+250 78 100 0002', prepTimeMin:8, prepTimeMax:15, openTime:'08:00', closeTime:'18:00', isOpen:true },
    { ownerName:'Sophie Green', ownerEmail:'sophie@greenbowl.rw', name:'Green Bowl', slug:'green-bowl', emoji:'🥗', coverColor:'#16a34a', category:'Healthy', description:'Nourishing salads, grain bowls, wraps and cold-pressed smoothies — brain food that actually tastes great.', location:'Garden Terrace', floor:'Ground Floor', phone:'+250 78 100 0003', prepTimeMin:5, prepTimeMax:12, openTime:'07:00', closeTime:'17:00', isOpen:true },
    { ownerName:'Marco Rossi', ownerEmail:'marco@pizzapalace.rw', name:'Pizza Palace', slug:'pizza-palace', emoji:'🍕', coverColor:'#7c3aed', category:'Italian', description:'Stone-baked thin-crust pizzas and handmade pastas — a taste of Italy on campus.', location:'Upper Level', floor:'First Floor', phone:'+250 78 100 0004', prepTimeMin:15, prepTimeMax:25, openTime:'10:00', closeTime:'19:00', isOpen:false },
    { ownerName:'Lin Wei', ownerEmail:'lin@dragonwok.rw', name:'Dragon Wok', slug:'dragon-wok', emoji:'🍜', coverColor:'#0891b2', category:'Asian', description:'Wok-fired noodles, fragrant ramen and bold Asian flavours made fresh and fast.', location:'East Canteen', floor:'First Floor', phone:'+250 78 100 0005', prepTimeMin:8, prepTimeMax:15, openTime:'08:00', closeTime:'18:00', isOpen:true },
    { ownerName:'Celine Dubois', ownerEmail:'celine@cafebj.rw', name:'Café Bonne Journée', slug:'cafe-bonne-journee', emoji:'☕', coverColor:'#92400e', category:'Café', description:'Specialty coffee, artisan pastries and hearty sandwiches — the perfect campus study break.', location:'Main Entrance', floor:'Ground Floor', phone:'+250 78 100 0006', prepTimeMin:3, prepTimeMax:10, openTime:'06:30', closeTime:'18:30', isOpen:true },
    { ownerName:'Raj Patel', ownerEmail:'raj@spiceroute.rw', name:'Spice Route', slug:'spice-route', emoji:'🍛', coverColor:'#b45309', category:'Indian', description:'Slow-cooked curries, fragrant biryanis and fresh naan from the tandoor.', location:'West Wing', floor:'Second Floor', phone:'+250 78 100 0007', prepTimeMin:15, prepTimeMax:25, openTime:'09:00', closeTime:'18:00', isOpen:true },
  ];

  const pw = await hash12('admin123');
  for (const r of restaurants) {
    const restaurant = await prisma.restaurant.create({ data: { ...r, passwordHash: pw, isApproved: true } });

    // Categories
    const cats = {
      'Mama Africa Kitchen': [{ name:'Main Dishes', emoji:'🍛' }, { name:'Sides', emoji:'🥘' }, { name:'Drinks', emoji:'🥤' }],
      'The Burger Spot': [{ name:'Burgers', emoji:'🍔' }, { name:'Sides', emoji:'🍟' }, { name:'Drinks', emoji:'🥤' }],
      'Green Bowl': [{ name:'Bowls & Salads', emoji:'🥗' }, { name:'Wraps', emoji:'🌯' }, { name:'Smoothies', emoji:'🥤' }],
      'Pizza Palace': [{ name:'Pizzas', emoji:'🍕' }, { name:'Pasta', emoji:'🍝' }, { name:'Sides', emoji:'🥖' }],
      'Dragon Wok': [{ name:'Noodles', emoji:'🍜' }, { name:'Rice Dishes', emoji:'🍚' }, { name:'Drinks', emoji:'🍵' }],
      'Café Bonne Journée': [{ name:'Hot Drinks', emoji:'☕' }, { name:'Cold Drinks', emoji:'🧊' }, { name:'Food', emoji:'🥐' }],
      'Spice Route': [{ name:'Curries', emoji:'🍛' }, { name:'Rice & Bread', emoji:'🍚' }, { name:'Drinks', emoji:'🥤' }],
    };

    const catMap = {};
    for (const [i, cat] of (cats[r.name] || []).entries()) {
      const c = await prisma.menuCategory.create({ data: { restaurantId: restaurant.id, ...cat, sortOrder: i } });
      catMap[cat.name] = c.id;
    }

    // Sample items per restaurant
    const items = {
      'Mama Africa Kitchen': [
        { name:'Isombe & Rice', emoji:'🌿', description:'Cassava leaves with eggplant in palm oil served over rice', price:2500, cat:'Main Dishes', isVeg:true, isFeatured:true, calories:480 },
        { name:'Goat Stew', emoji:'🍖', description:'Slow-cooked tender goat in rich tomato & herb sauce', price:3800, cat:'Main Dishes', isFeatured:true, calories:620 },
        { name:'Grilled Tilapia', emoji:'🐟', description:'Whole Nile tilapia, seasoned & chargrilled', price:4200, cat:'Main Dishes', calories:540 },
        { name:'Ugali & Sukuma', emoji:'🌽', description:'Cornmeal cake with stir-fried collard greens', price:1500, cat:'Main Dishes', isVeg:true, calories:380 },
        { name:'Fried Plantains', emoji:'🍌', price:800, cat:'Sides', isVeg:true, isVegan:true, calories:180 },
        { name:'Passion Juice', emoji:'🧃', price:700, cat:'Drinks', isVeg:true, calories:90 },
      ],
      'The Burger Spot': [
        { name:'Classic Smash Burger', emoji:'🍔', description:'120g smashed beef, cheddar, pickles, special sauce', price:3500, cat:'Burgers', isFeatured:true, isPopular:true, calories:650 },
        { name:'Double Stack', emoji:'🍔', description:'Double patty, double cheese, caramelised onions', price:4800, cat:'Burgers', calories:950 },
        { name:'Crispy Chicken Burger', emoji:'🍗', description:'Fried chicken fillet, coleslaw, sriracha mayo', price:3200, cat:'Burgers', isPopular:true, calories:720 },
        { name:'Veggie Burger', emoji:'🌿', description:'Black bean patty, avocado, roasted pepper', price:2800, cat:'Burgers', isVeg:true, calories:480 },
        { name:'Crispy Fries', emoji:'🍟', price:1000, cat:'Sides', isVeg:true, calories:380 },
        { name:'Chocolate Shake', emoji:'🍫', price:2000, cat:'Drinks', isVeg:true, isFeatured:true, calories:420 },
        { name:'Soft Drink', emoji:'🥤', price:600, cat:'Drinks', isVeg:true, calories:140 },
      ],
      'Green Bowl': [
        { name:'Power Grain Bowl', emoji:'🌾', description:'Quinoa, roasted sweet potato, chickpeas, tahini dressing', price:3800, cat:'Bowls & Salads', isVeg:true, isVegan:true, isFeatured:true, calories:520 },
        { name:'Caesar Salad', emoji:'🥬', description:'Romaine, caesar dressing, parmesan, croutons', price:2500, cat:'Bowls & Salads', isVeg:true, calories:340 },
        { name:'Avocado Wrap', emoji:'🥑', description:'Whole wheat, avocado, hummus, cucumber, sprouts', price:2800, cat:'Wraps', isVeg:true, isVegan:true, isFeatured:true, calories:420 },
        { name:'Green Smoothie', emoji:'🥦', description:'Spinach, banana, mango, coconut water', price:1800, cat:'Smoothies', isVeg:true, isVegan:true, isFeatured:true, calories:180 },
        { name:'Berry Blast', emoji:'🍓', price:2000, cat:'Smoothies', isVeg:true, calories:210 },
      ],
      'Pizza Palace': [
        { name:'Margherita', emoji:'🍕', description:'San Marzano tomato, mozzarella, fresh basil', price:5500, cat:'Pizzas', isVeg:true, isFeatured:true, calories:800 },
        { name:'Pepperoni Fire', emoji:'🌶️', description:'Double pepperoni, chilli flakes, honey drizzle', price:6800, cat:'Pizzas', isFeatured:true, isSpicy:true, calories:980 },
        { name:'BBQ Chicken', emoji:'🍗', description:'BBQ sauce, grilled chicken, red onion', price:6200, cat:'Pizzas', calories:880 },
        { name:'Spaghetti Bolognese', emoji:'🍝', description:'6-hour beef ragù, al dente pasta, parmesan', price:4800, cat:'Pasta', isFeatured:true, calories:680 },
        { name:'Garlic Focaccia', emoji:'🥖', price:1200, cat:'Sides', isVeg:true, calories:260 },
      ],
      'Dragon Wok': [
        { name:'Tonkotsu Ramen', emoji:'🍜', description:'Rich pork broth, noodles, chashu, soft egg, nori', price:4500, cat:'Noodles', isFeatured:true, isPopular:true, calories:680 },
        { name:'Beef Chow Mein', emoji:'🥩', description:'Wok-fried noodles, tender beef, bok choy', price:3800, cat:'Noodles', isFeatured:true, calories:580 },
        { name:'Pad Thai', emoji:'🦐', description:'Rice noodles, egg, peanuts, tamarind sauce', price:3800, cat:'Noodles', calories:610 },
        { name:'Fried Rice Special', emoji:'🍳', description:'Egg fried rice, mixed veg, choice of protein', price:3200, cat:'Rice Dishes', isFeatured:true, calories:540 },
        { name:'Bubble Tea', emoji:'🧋', description:'Taro or matcha with tapioca pearls', price:1500, cat:'Drinks', isVeg:true, isFeatured:true, calories:280 },
      ],
      'Café Bonne Journée': [
        { name:'Cappuccino', emoji:'☕', description:'Double espresso with velvety steamed milk', price:1300, cat:'Hot Drinks', isVeg:true, isFeatured:true, isPopular:true, calories:120 },
        { name:'Flat White', emoji:'☕', price:1400, cat:'Hot Drinks', isVeg:true, calories:130 },
        { name:'Hot Chocolate', emoji:'🍫', description:'Belgian dark chocolate, whipped cream', price:1400, cat:'Hot Drinks', isVeg:true, calories:280 },
        { name:'Iced Latte', emoji:'🧊', description:'Cold brew, oat milk, ice', price:1600, cat:'Cold Drinks', isVeg:true, isFeatured:true, calories:80 },
        { name:'Fresh OJ', emoji:'🍊', price:1500, cat:'Cold Drinks', isVeg:true, isVegan:true, isPopular:true, calories:110 },
        { name:'Butter Croissant', emoji:'🥐', description:'All-butter, baked fresh every morning', price:1200, cat:'Food', isVeg:true, isFeatured:true, isPopular:true, calories:240 },
        { name:'Avocado Toast', emoji:'🥑', description:'Sourdough, smashed avo, poached egg, chilli', price:3200, cat:'Food', isVeg:true, isFeatured:true, calories:420 },
        { name:'Club Sandwich', emoji:'🥪', price:3800, cat:'Food', calories:650 },
      ],
      'Spice Route': [
        { name:'Butter Chicken', emoji:'🍗', description:'Tandoori chicken in tomato-cream sauce', price:4800, cat:'Curries', isFeatured:true, isPopular:true, calories:680 },
        { name:'Dal Makhani', emoji:'🫘', description:'Black lentils slow-cooked 12 hours', price:3200, cat:'Curries', isVeg:true, isFeatured:true, calories:480 },
        { name:'Palak Paneer', emoji:'🌿', description:'Cottage cheese in spiced spinach gravy', price:3800, cat:'Curries', isVeg:true, calories:520 },
        { name:'Lamb Biryani', emoji:'🍚', description:'Basmati layered with spiced lamb, saffron', price:5800, cat:'Rice & Bread', isFeatured:true, isPopular:true, calories:780 },
        { name:'Garlic Naan', emoji:'🫓', price:900, cat:'Rice & Bread', isVeg:true, isFeatured:true, calories:260 },
        { name:'Mango Lassi', emoji:'🥭', description:'Yoghurt blended with Alphonso mango', price:1300, cat:'Drinks', isVeg:true, isFeatured:true, calories:200 },
        { name:'Masala Chai', emoji:'🍵', price:700, cat:'Drinks', isVeg:true, isPopular:true, calories:120 },
      ],
    };

    for (const [i, item] of (items[r.name] || []).entries()) {
      const { cat, ...itemData } = item;
      await prisma.menuItem.create({ data: { restaurantId:restaurant.id, categoryId:catMap[cat]||null, sortOrder:i, prepTime:Math.floor((r.prepTimeMin+r.prepTimeMax)/2), ...itemData } });
    }

    // Sample promo
    const slug = r.slug.split('-')[0].toUpperCase();
    await prisma.promotion.create({ data: { restaurantId:restaurant.id, code:`${slug}10`, title:'10% Off Welcome', type:'percentage', value:10, minOrder:2000, maxDiscount:1000, validFrom:new Date(), validUntil:new Date(Date.now()+90*86400000) } });

    console.log(`  ✅ ${r.name} — login: ${r.ownerEmail} / admin123`);
  }

  // ── Demo Customers ─────────────────────────────────────────
  const customers = [
    { accountType:'registered', name:'Alice Uwimana', email:'alice@school.ac.rw', studentId:'STU001', year:'Year 3', department:'Computer Science' },
    { accountType:'registered', name:'Bob Nkurunziza', email:'bob@school.ac.rw', studentId:'STU002', year:'Year 2', department:'Business' },
  ];
  const custPw = await hash12('password123');
  for (const c of customers) {
    await prisma.customer.create({ data: { ...c, passwordHash:custPw } });
    console.log(`  👤 Customer: ${c.name} — email: ${c.email} / password123  studentId: ${c.studentId}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ SEED COMPLETE\n');
  console.log('🔑 SUPER ADMIN: superadmin / super123');
  console.log('   Login at: /admin/superadmin\n');
  console.log('🏪 RESTAURANT LOGINS (all password: admin123)');
  console.log('   Each restaurant owner logs in with their EMAIL\n');
  console.log('   Use /restaurant/login to sign in or /restaurant/register to create a new one\n');
  console.log('👤 DEMO CUSTOMERS (password: password123)');
  console.log('   alice@school.ac.rw  or  STU001');
  console.log('   bob@school.ac.rw    or  STU002');
  console.log('   — OR order as a Guest (no account needed)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
