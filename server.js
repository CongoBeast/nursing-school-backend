const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');
const fs = require('fs');

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your_jwt_secret';

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'https://nursing-school-frontend.vercel.app'
    ];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};


app.use(cors(corsOptions));
// app.options('*', cors(corsOptions)); //  THIS FIXES PREFLIGHT
// app.use(cors({
//   origin: '*',
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization']
// }));

// app.use((req, res, next) => {
//   res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
//   res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
//   res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
//   next();
// });

/* =========================
   MongoDB Connection
========================= */

const uri = "mongodb+srv://congo43:4596manu@cluster0.2vjumfn.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

let db;
let usersCollection;

async function startServer() {
  try {
    console.log('⏳ Connecting to MongoDB...');

    await client.connect();

    db = client.db('nursing-school');
    usersCollection = db.collection('users');

    console.log('✅ MongoDB connected');

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
}




async function connectDB() {
  await client.connect();
  db = client.db('nursing-school');
  usersCollection = db.collection('users');
  console.log('✅ Connected to MongoDB');
}

connectDB().catch(console.error);

/* =========================
   Utilities
========================= */

const generateToken = (userId) => {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '1h' });
};

const encryptPassword = async (password) => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

const generateId = () => {
  return crypto.randomBytes(12).toString('hex');
};

/* =========================
   Cloudinary
========================= */

cloudinary.config({
  cloud_name: "dxxlrzouc",
  api_key: "191187614991536",
  api_secret: "9b75q3SXcar-yJFsWQsfXWFhnM8",
});

/* =========================
   Auth Routes
========================= */

app.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword, ...rest } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const existingUser = await usersCollection.findOne({
      $or: [{ username }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await encryptPassword(password);

    const result = await usersCollection.insertOne({
      username,
      email,
      hashedPassword,
      ...rest,
      signupTimestamp: new Date(),
      isLoggedOn: false
    });

    const token = generateToken(result.insertedId.toString());
    res.json({ token });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(401).send('Invalid credentials');

    const valid = bcrypt.compareSync(password, user.hashedPassword);
    if (!valid) return res.status(401).send('Invalid credentials');

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { isLoggedOn: true, loginTimestamp: new Date() } }
    );

    res.json({ token });

  } catch (error) {
    console.error(error);
    res.status(500).send('Login failed');
  }
});

/* =========================
   Notices Routes
========================= */

app.post('/add-notice', async (req, res) => {
  try {
    const { title, content, priority, date, postedBy } = req.body;

    if (!title || !content || !date || !postedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const noticesCollection = db.collection('notices');

    const result = await noticesCollection.insertOne({
      title,
      content,
      priority: priority || 'medium',
      date,
      postedBy,
      createdAt: new Date()
    });

    res.json({ success: true, noticeId: result.insertedId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add notice' });
  }
});

app.get('/get-notices', async (req, res) => {
  try {
    const noticesCollection = db.collection('notices');
    const notices = await noticesCollection
      .find({})
      .sort({ date: -1 })
      .toArray();
    
    res.json(notices);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch notices' });
  }
});

/* =========================
   Events Routes
========================= */

app.post('/add-event', async (req, res) => {
  try {
    const { title, datetime, location, postedBy } = req.body;

    if (!title || !datetime || !location || !postedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const eventsCollection = db.collection('events');

    // Extract date and time from datetime
    const eventDate = new Date(datetime);
    const date = eventDate.toISOString().split('T')[0];
    const time = eventDate.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const result = await eventsCollection.insertOne({
      title,
      date,
      time,
      location,
      postedBy,
      createdAt: new Date()
    });

    res.json({ success: true, eventId: result.insertedId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add event' });
  }
});

app.get('/get-events', async (req, res) => {
  try {
    const eventsCollection = db.collection('events');
    const events = await eventsCollection
      .find({})
      .sort({ date: 1 })
      .toArray();
    
    res.json(events);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

/* =========================
   User Management
========================= */

app.get('/get-user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const user = await usersCollection.findOne({ username });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't send the hashed password to the frontend
    const { hashedPassword, ...userWithoutPassword } = user;
    
    res.json(userWithoutPassword);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Optional: Update user profile
app.put('/update-user/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { email, phone, address, photo } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username required' });
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (photo) updateData.photo = photo;
    
    updateData.lastUpdated = new Date();

    const result = await usersCollection.updateOne(
      { username },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'Profile updated successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.post('/delete-user', async (req, res) => {
  try {
    const { filter, update } = req.body;
    if (!filter?._id) {
      return res.status(400).json({ error: 'Missing _id' });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(filter._id) },
      { $set: update }
    );

    res.json(result);

  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
});

/* =========================
   File Upload
========================= */

const upload = multer({ dest: 'uploads/' });

app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: 'chat_avatars'
    });

    fs.unlinkSync(req.file.path);
    res.json({ success: true, url: result.secure_url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false });
  }
});

/* =========================
   Server
========================= */

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

startServer();



