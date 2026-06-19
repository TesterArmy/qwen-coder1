import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// Initialize Database
const db = new Database(join(__dirname, 'bike-rental.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS bikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    pricePerHour REAL NOT NULL,
    available INTEGER DEFAULT 1,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bikeId INTEGER NOT NULL,
    customerName TEXT NOT NULL,
    customerEmail TEXT NOT NULL,
    customerPhone TEXT,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    totalHours INTEGER NOT NULL,
    totalPrice REAL NOT NULL,
    status TEXT DEFAULT 'confirmed',
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (bikeId) REFERENCES bikes(id)
  );
`);

// Seed initial bikes if empty
const bikeCount = db.prepare('SELECT COUNT(*) as count FROM bikes').get();
if (bikeCount.count === 0) {
  const insertBike = db.prepare('INSERT INTO bikes (name, type, pricePerHour, image) VALUES (?, ?, ?, ?)');
  const bikes = [
    ['Mountain Bike Pro', 'Mountain', 15.00, 'https://images.unsplash.com/photo-1576435728678-38d01d52e38b?w=400'],
    ['Road Racer X', 'Road', 20.00, 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=400'],
    ['City Cruiser', 'City', 12.00, 'https://images.unsplash.com/photo-1507035895480-2b3156c31fc8?w=400'],
    ['Electric Bike Plus', 'Electric', 25.00, 'https://images.unsplash.com/photo-1571068316344-75bc76f77890?w=400'],
    ['Hybrid Adventure', 'Hybrid', 18.00, 'https://images.unsplash.com/photo-1532298229144-0ec0c57515c7?w=400'],
    ['Kids Bike Fun', 'Kids', 8.00, 'https://images.unsplash.com/photo-1596707323534-78f06792a6d3?w=400']
  ];
  
  db.transaction(() => {
    bikes.forEach(bike => insertBike.run(...bike));
  })();
}

// API Routes

// Get all bikes
app.get('/api/bikes', (req, res) => {
  try {
    const bikes = db.prepare('SELECT * FROM bikes').all();
    res.json(bikes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available bikes
app.get('/api/bikes/available', (req, res) => {
  try {
    const bikes = db.prepare('SELECT * FROM bikes WHERE available = 1').all();
    res.json(bikes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create booking
app.post('/api/bookings', (req, res) => {
  try {
    const { bikeId, customerName, customerEmail, customerPhone, startDate, endDate } = req.body;
    
    if (!bikeId || !customerName || !customerEmail || !startDate || !endDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Calculate total hours and price
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalHours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
    
    const bike = db.prepare('SELECT * FROM bikes WHERE id = ?').get(bikeId);
    if (!bike) {
      return res.status(404).json({ error: 'Bike not found' });
    }

    const totalPrice = totalHours * bike.pricePerHour;

    // Create booking
    const insertBooking = db.prepare(`
      INSERT INTO bookings (bikeId, customerName, customerEmail, customerPhone, startDate, endDate, totalHours, totalPrice)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertBooking.run(bikeId, customerName, customerEmail, customerPhone || '', 
                                      startDate, endDate, totalHours, totalPrice);

    // Update bike availability
    db.prepare('UPDATE bikes SET available = 0 WHERE id = ?').run(bikeId);

    res.status(201).json({
      id: result.lastInsertRowid,
      bikeId,
      customerName,
      customerEmail,
      customerPhone,
      startDate,
      endDate,
      totalHours,
      totalPrice,
      message: 'Booking created successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all bookings
app.get('/api/bookings', (req, res) => {
  try {
    const bookings = db.prepare(`
      SELECT b.*, bk.name as bikeName, bk.type as bikeType
      FROM bookings b
      JOIN bikes bk ON b.bikeId = bk.id
      ORDER BY b.createdAt DESC
    `).all();
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get booking by ID
app.get('/api/bookings/:id', (req, res) => {
  try {
    const booking = db.prepare(`
      SELECT b.*, bk.name as bikeName, bk.type as bikeType, bk.pricePerHour
      FROM bookings b
      JOIN bikes bk ON b.bikeId = bk.id
      WHERE b.id = ?
    `).get(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cancel booking
app.put('/api/bookings/:id/cancel', (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('cancelled', req.params.id);
    db.prepare('UPDATE bikes SET available = 1 WHERE id = ?').run(booking.bikeId);

    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Complete booking (return bike)
app.put('/api/bookings/:id/complete', (req, res) => {
  try {
    const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('completed', req.params.id);
    db.prepare('UPDATE bikes SET available = 1 WHERE id = ?').run(booking.bikeId);

    res.json({ message: 'Booking completed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, '../public/index.html'));
});

// Serve admin/dashboard page
app.get('/admin', (req, res) => {
  res.sendFile(join(__dirname, '../public/admin.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Admin dashboard at http://localhost:${PORT}/admin`);
});
