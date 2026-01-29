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

    // await seedHousingCollection();

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
   Database Seeding Utility
========================= */

// async function seedHousingCollection() {
//   try {
//     const housingCollection = db.collection('housing');
    
//     // Check if data already exists to avoid duplicates
//     const count = await housingCollection.countDocuments();
//     if (count > 0) {
//       console.log('ℹ️ Housing collection already populated. Skipping seed.');
//       return;
//     }

//     const rooms = [];

//     // Generate Adlam House Rooms (119)
//     for (let i = 1; i <= 119; i++) {
//       rooms.push({
//         house: 'Adlam House',
//         roomNumber: `A${i.toString().padStart(2, '0')}`, // e.g., A01, A119
//         residents: [],
//         fault_reports: [],
//         status: 'available'
//       });
//     }

//     // Generate Nurse Home Rooms (122)
//     for (let i = 1; i <= 122; i++) {
//       rooms.push({
//         house: 'Nurse Home',
//         roomNumber: `N${i.toString().padStart(2, '0')}`, // e.g., N01, N122
//         residents: [],
//         fault_reports: [],
//         status: 'available'
//       });
//     }

//     const result = await housingCollection.insertMany(rooms);
//     console.log(`✅ Successfully seeded housing collection with ${result.insertedCount} rooms.`);

//   } catch (error) {
//     console.error('❌ Error seeding housing collection:', error);
//   }
// }

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
   Students with Housing Info
========================= */

app.get('/get-students-with-housing', async (req, res) => {
  try {
    const housingCollection = db.collection('housing');
    
    // Get only users where userType is 'student'
    const students = await usersCollection.find({ userType: 'student' }).toArray();
    
    // Get all housing data
    const housingData = await housingCollection.find({}).toArray();
    
    // Create a map of userId to housing info
    const housingMap = {};
    housingData.forEach(room => {
      room.residents.forEach(residentId => {
        housingMap[residentId] = {
          house: room.house,
          roomNumber: room.roomNumber,
          status: room.status
        };
      });
    });
    
    // Combine student data with housing info
    const studentsWithHousing = students.map(student => {
      const housing = housingMap[student._id.toString()] || {};
      const { hashedPassword, ...studentWithoutPassword } = student;
      
      return {
        ...studentWithoutPassword,
        dormHouse: housing.house || '',
        dormNumber: housing.roomNumber || '',
        roomStatus: housing.status || 'unassigned'
      };
    });
    
    res.json(studentsWithHousing);

    // console.log(studentsWithHousing);
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch students with housing' });
  }
});

/* =========================
   Housing Management Routes
========================= */

app.post('/assign-student-housing', async (req, res) => {
  try {
    const { studentId, house, roomNumber } = req.body;

    if (!studentId || !house || !roomNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const housingCollection = db.collection('housing');
    const housingRecordsCollection = db.collection('student_housing_records');

    // Find the student to get their _id
    const student = await usersCollection.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the room
    const room = await housingCollection.findOne({ house, roomNumber });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Check if room is full (2 or more residents)
    if (room.residents && room.residents.length >= 2) {
      return res.status(400).json({ 
        message: 'Room is full', 
        currentResidents: room.residents.length 
      });
    }

    // Add student's _id to room (not studentId)
    await housingCollection.updateOne(
      { house, roomNumber },
      { 
        $push: { residents: student._id.toString() },
        $set: { status: room.residents.length === 1 ? 'occupied' : 'available' }
      }
    );

    // Create housing record
    await housingRecordsCollection.insertOne({
      studentId,
      action: 'assigned',
      description: `Student ${studentId} has been assigned to ${house} - Room ${roomNumber}`,
      house,
      roomNumber,
      timestamp: new Date(),
      performedBy: req.body.performedBy || 'admin'
    });

    res.json({ success: true, message: 'Student assigned successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to assign student' });
  }
});

app.post('/move-student-housing', async (req, res) => {
  try {
    const { studentId, currentHouse, currentRoom, newHouse, newRoom } = req.body;

    if (!studentId || !newHouse || !newRoom) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const housingCollection = db.collection('housing');
    const housingRecordsCollection = db.collection('student_housing_records');

    // Find the student to get their _id
    const student = await usersCollection.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the new room
    const newRoomData = await housingCollection.findOne({ house: newHouse, roomNumber: newRoom });

    if (!newRoomData) {
      return res.status(404).json({ message: 'New room not found' });
    }

    // Check if new room is full
    if (newRoomData.residents && newRoomData.residents.length >= 2) {
      return res.status(400).json({ 
        message: 'New room is full', 
        currentResidents: newRoomData.residents.length 
      });
    }

    // Remove student from old room if they have one
    if (currentHouse && currentRoom) {
      const oldRoom = await housingCollection.findOne({ house: currentHouse, roomNumber: currentRoom });
      await housingCollection.updateOne(
        { house: currentHouse, roomNumber: currentRoom },
        { 
          $pull: { residents: student._id.toString() },
          $set: { status: oldRoom.residents.length <= 2 ? 'available' : 'occupied' }
        }
      );
    }

    // Add student to new room
    await housingCollection.updateOne(
      { house: newHouse, roomNumber: newRoom },
      { 
        $push: { residents: student._id.toString() },
        $set: { status: newRoomData.residents.length === 1 ? 'occupied' : 'available' }
      }
    );

    // Create housing record
    const description = currentHouse && currentRoom 
      ? `Student ${studentId} has been moved from ${currentHouse} - Room ${currentRoom} to ${newHouse} - Room ${newRoom}`
      : `Student ${studentId} has been assigned to ${newHouse} - Room ${newRoom}`;

    await housingRecordsCollection.insertOne({
      studentId,
      action: 'moved',
      description,
      oldHouse: currentHouse || null,
      oldRoom: currentRoom || null,
      newHouse,
      newRoom,
      timestamp: new Date(),
      performedBy: req.body.performedBy || 'admin'
    });

    res.json({ success: true, message: 'Student moved successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to move student' });
  }
});

app.post('/deactivate-student-housing', async (req, res) => {
  try {
    const { studentId, house, roomNumber } = req.body;

    if (!studentId || !house || !roomNumber) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const housingCollection = db.collection('housing');
    const housingRecordsCollection = db.collection('student_housing_records');

    // Find the student to get their _id
    const student = await usersCollection.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Find the room
    const room = await housingCollection.findOne({ house, roomNumber });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Remove student from room
    await housingCollection.updateOne(
      { house, roomNumber },
      { 
        $pull: { residents: student._id.toString() },
        $set: { status: room.residents.length <= 2 ? 'available' : 'occupied' }
      }
    );

    // Create housing record
    await housingRecordsCollection.insertOne({
      studentId,
      action: 'deactivated',
      description: `Student ${studentId} has been removed from ${house} - Room ${roomNumber}`,
      house,
      roomNumber,
      timestamp: new Date(),
      performedBy: req.body.performedBy || 'admin'
    });

    res.json({ success: true, message: 'Student housing deactivated successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to deactivate student housing' });
  }
});


/* =========================
   Room Occupancy Overview
========================= */

app.get('/get-room-occupancy', async (req, res) => {
  try {
    const housingCollection = db.collection('housing');
    
    // Get all rooms with their residents
    const rooms = await housingCollection.find({}).toArray();
    
    // Get all students to map their info
    const students = await usersCollection.find({ userType: 'student' }).toArray();
    
    // Create a map of student _id to student info
    const studentMap = {};
    students.forEach(student => {
      studentMap[student._id.toString()] = {
        studentId: student.studentId,
        username: student.username,
        gender: student.gender,
        photo: student.photo || student.avatar
      };
    });
    
    // Enhance rooms with resident details
    const roomsWithDetails = rooms.map(room => ({
      house: room.house,
      roomNumber: room.roomNumber,
      status: room.status,
      capacity: 2,
      occupancy: room.residents.length,
      residents: room.residents.map(residentId => studentMap[residentId] || { studentId: 'Unknown', username: 'Unknown' })
    }));
    
    // Group by house
    const adlamRooms = roomsWithDetails.filter(r => r.house === 'Adlam House');
    const nurseRooms = roomsWithDetails.filter(r => r.house === 'Nurse Home');
    
    res.json({
      adlamHouse: {
        totalRooms: 119,
        rooms: adlamRooms,
        occupied: adlamRooms.filter(r => r.occupancy > 0).length,
        available: adlamRooms.filter(r => r.occupancy === 0).length,
        full: adlamRooms.filter(r => r.occupancy >= 2).length
      },
      nurseHome: {
        totalRooms: 122,
        rooms: nurseRooms,
        occupied: nurseRooms.filter(r => r.occupancy > 0).length,
        available: nurseRooms.filter(r => r.occupancy === 0).length,
        full: nurseRooms.filter(r => r.occupancy >= 2).length
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch room occupancy' });
  }
});

/* =========================
   Fault Reports Routes
========================= */

app.post('/add-fault-report', upload.single('image'), async (req, res) => {
  try {
    const { house, roomNumber, item, details, discoveryDate, reportedBy } = req.body;

    if (!house || !roomNumber || !item || !discoveryDate || !reportedBy) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const faultReportsCollection = db.collection('fault_reports');

    // Generate fault report ID (e.g., FR-2026-001)
    const year = new Date().getFullYear();
    const count = await faultReportsCollection.countDocuments();
    const faultReportId = `FR-${year}-${String(count + 1).padStart(3, '0')}`;

    // Upload image to Cloudinary if provided
    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'fault_reports'
      });
      fs.unlinkSync(req.file.path);
      imageUrl = result.secure_url;
    }

    const result = await faultReportsCollection.insertOne({
      faultReportId,
      house,
      roomNumber,
      item,
      details: details || '',
      discoveryDate,
      reportedBy,
      imageUrl,
      status: 'Pending',
      createdAt: new Date()
    });

    res.json({ success: true, faultReportId: result.insertedId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to add fault report' });
  }
});

app.get('/get-fault-reports', async (req, res) => {
  try {
    const faultReportsCollection = db.collection('fault_reports');
    const reports = await faultReportsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();
    
    res.json(reports);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch fault reports' });
  }
});

app.put('/update-fault-status', async (req, res) => {
  try {
    const { faultReportId, status } = req.body;

    if (!faultReportId || !status) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const faultReportsCollection = db.collection('fault_reports');

    const result = await faultReportsCollection.updateOne(
      { _id: new ObjectId(faultReportId) },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Fault report not found' });
    }

    res.json({ success: true, message: 'Status updated successfully' });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update status' });
  }
});

/* =========================
   Server
========================= */

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

startServer();



