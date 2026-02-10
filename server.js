const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const dotenv = require("dotenv");
const fs = require("fs");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const PORT = 5000;
const JWT_SECRET = "your_jwt_secret";

console.log("is this working ?");

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { MailtrapClient } = require("mailtrap");

const TOKEN = "f7a7fd52c5c1f3c5ac232ceaf4536227";

const mailClient = new MailtrapClient({
  token: TOKEN,
});

const sender = {
  email: "hello@demomailtrap.co",
  name: "Mailtrap Test",
};
const recipients = [
  {
    email: "thomasmethembe43@gmail.com",
  },
];

mailClient
  .send({
    from: sender,
    to: recipients,
    subject: "You are awesome!",
    text: "Congrats for sending test email with Mailtrap!",
    category: "Integration Test",
  })
  .then(console.log, console.error);

const corsOptions = {
  origin: true, // reflect request origin
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.set("trust proxy", 1);

/* =========================
   MongoDB Connection
========================= */

const uri =
  "mongodb+srv://congo43:4596manu@cluster0.2vjumfn.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
let usersCollection;

async function startServer() {
  try {
    console.log("⏳ Connecting to MongoDB...");

    await client.connect();

    db = client.db("nursing-school-prod");
    usersCollection = db.collection("users");

    // await seedHousingCollection();

    console.log("✅ MongoDB connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

async function connectDB() {
  await client.connect();
  db = client.db("nursing-school-prod");
  usersCollection = db.collection("users");
  console.log("✅ Connected to MongoDB");
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
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "1h" });
};

const encryptPassword = async (password) => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

const generateId = () => {
  return crypto.randomBytes(12).toString("hex");
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

app.post("/register", async (req, res) => {
  try {
    const { username, email, password, confirmPassword, ...rest } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const existingUser = await usersCollection.findOne({
      $or: [{ username }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await encryptPassword(password);

    const result = await usersCollection.insertOne({
      username,
      email,
      hashedPassword,
      ...rest,
      signupTimestamp: new Date(),
      isLoggedOn: false,
    });

    // ✅ Create welcome notification
    // await createNotification(
    //   result.insertedId.toString(),
    //   username,
    //   "account_created",
    //   "Your account has been successfully created"
    // );

    const notificationsCollection = db.collection("user_notifications");
    await notificationsCollection.insertOne({
      userId: result.insertedId.toString(),
      username: username,
      notificationType: "signup",
      message: `Dear ${username}, thank you for signing up`,
      timestamp: new Date(),
      read: false,
    });

    const token = generateToken(result.insertedId.toString());
    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await usersCollection.findOne({ username });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = bcrypt.compareSync(password, user.hashedPassword);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, {
      expiresIn: "1h",
    });

    await usersCollection.updateOne(
      { _id: user._id },
      { $set: { isLoggedOn: true, loginTimestamp: new Date() } },
    );

    // ✅ Return token, username, and userType
    res.json({
      token,
      username: user.username,
      userType: user.userType,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
});

/* =========================
   Notices Routes
========================= */

app.post("/add-notice", async (req, res) => {
  try {
    const { title, content, priority, date, postedBy } = req.body;

    if (!title || !content || !date || !postedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const noticesCollection = db.collection("notices");

    const result = await noticesCollection.insertOne({
      title,
      content,
      priority: priority || "medium",
      date,
      postedBy,
      createdAt: new Date(),
    });

    res.json({ success: true, noticeId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add notice" });
  }
});

app.get("/get-notices", async (req, res) => {
  try {
    const noticesCollection = db.collection("notices");
    const notices = await noticesCollection
      .find({})
      .sort({ date: -1 })
      .toArray();

    res.json(notices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch notices" });
  }
});

/* =========================
   Events Routes
========================= */

app.post("/add-event", async (req, res) => {
  try {
    const { title, datetime, location, postedBy } = req.body;

    if (!title || !datetime || !location || !postedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const eventsCollection = db.collection("events");

    // Extract date and time from datetime
    const eventDate = new Date(datetime);
    const date = eventDate.toISOString().split("T")[0];
    const time = eventDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const result = await eventsCollection.insertOne({
      title,
      date,
      time,
      location,
      postedBy,
      createdAt: new Date(),
    });

    res.json({ success: true, eventId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add event" });
  }
});

app.get("/get-events", async (req, res) => {
  try {
    const eventsCollection = db.collection("events");
    const events = await eventsCollection.find({}).sort({ date: 1 }).toArray();

    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch events" });
  }
});

/* =========================
   User Management
========================= */

app.get("/get-user/:username", async (req, res) => {
  try {
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    const user = await usersCollection.findOne({ username });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Don't send the hashed password to the frontend
    const { hashedPassword, ...userWithoutPassword } = user;

    res.json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// Optional: Update user profile
app.put("/update-user/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { email, phone, address, photo } = req.body;

    if (!username) {
      return res.status(400).json({ error: "Username required" });
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;
    if (photo) updateData.photo = photo;

    updateData.lastUpdated = new Date();

    const result = await usersCollection.updateOne(
      { username },
      { $set: updateData },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.post("/delete-user", async (req, res) => {
  try {
    const { filter, update } = req.body;
    if (!filter?._id) {
      return res.status(400).json({ error: "Missing _id" });
    }

    const result = await usersCollection.updateOne(
      { _id: new ObjectId(filter._id) },
      { $set: update },
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

const upload = multer({ dest: "uploads/" });

app.post("/upload", upload.single("image"), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "chat_avatars",
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

app.get("/get-students-with-housing", async (req, res) => {
  try {
    const housingCollection = db.collection("housing");

    // Get only users where userType is 'student'
    const students = await usersCollection
      .find({ userType: "student" })
      .toArray();

    // Get all housing data
    const housingData = await housingCollection.find({}).toArray();

    // Create a map of userId to housing info
    const housingMap = {};
    housingData.forEach((room) => {
      room.residents.forEach((residentId) => {
        housingMap[residentId] = {
          house: room.house,
          roomNumber: room.roomNumber,
          status: room.status,
        };
      });
    });

    // Combine student data with housing info
    const studentsWithHousing = students.map((student) => {
      const housing = housingMap[student._id.toString()] || {};
      const { hashedPassword, ...studentWithoutPassword } = student;

      return {
        ...studentWithoutPassword,
        dormHouse: housing.house || "",
        dormNumber: housing.roomNumber || "",
        roomStatus: housing.status || "unassigned",
      };
    });

    res.json(studentsWithHousing);

    // console.log(studentsWithHousing);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch students with housing" });
  }
});

/* =========================
   Housing Management Routes
========================= */

app.post("/assign-student-housing", async (req, res) => {
  try {
    const { studentId, house, roomNumber } = req.body;

    if (!studentId || !house || !roomNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const housingCollection = db.collection("housing");
    const housingRecordsCollection = db.collection("student_housing_records");

    // Find the student to get their _id
    const student = await usersCollection.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Find the room
    const room = await housingCollection.findOne({ house, roomNumber });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check if room is full (2 or more residents)
    if (room.residents && room.residents.length >= 2) {
      return res.status(400).json({
        message: "Room is full",
        currentResidents: room.residents.length,
      });
    }

    // Add student's _id to room (not studentId)
    await housingCollection.updateOne(
      { house, roomNumber },
      {
        $push: { residents: student._id.toString() },
        $set: {
          status: room.residents.length === 1 ? "occupied" : "available",
        },
      },
    );

    // Create housing record
    await housingRecordsCollection.insertOne({
      studentId,
      action: "assigned",
      description: `Student ${studentId} has been assigned to ${house} - Room ${roomNumber}`,
      house,
      roomNumber,
      timestamp: new Date(),
      performedBy: req.body.performedBy || "admin",
    });

    // ✅ CREATE NOTIFICATION
    await createNotification(
      student._id.toString(),
      student.username,
      "housing_assigned",
      `You have been assigned to ${house} - Room ${roomNumber}`,
    );

    res.json({ success: true, message: "Student assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to assign student" });
  }
});

app.post("/move-student-housing", async (req, res) => {
  try {
    const { studentId, currentHouse, currentRoom, newHouse, newRoom } =
      req.body;

    if (!studentId || !newHouse || !newRoom) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const housingCollection = db.collection("housing");
    const housingRecordsCollection = db.collection("student_housing_records");

    // Find the student to get their _id
    const student = await usersCollection.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Find the new room
    const newRoomData = await housingCollection.findOne({
      house: newHouse,
      roomNumber: newRoom,
    });

    if (!newRoomData) {
      return res.status(404).json({ message: "New room not found" });
    }

    // Check if new room is full
    if (newRoomData.residents && newRoomData.residents.length >= 2) {
      return res.status(400).json({
        message: "New room is full",
        currentResidents: newRoomData.residents.length,
      });
    }

    // Remove student from old room if they have one
    if (currentHouse && currentRoom) {
      const oldRoom = await housingCollection.findOne({
        house: currentHouse,
        roomNumber: currentRoom,
      });
      await housingCollection.updateOne(
        { house: currentHouse, roomNumber: currentRoom },
        {
          $pull: { residents: student._id.toString() },
          $set: {
            status: oldRoom.residents.length <= 2 ? "available" : "occupied",
          },
        },
      );
    }

    // Add student to new room
    await housingCollection.updateOne(
      { house: newHouse, roomNumber: newRoom },
      {
        $push: { residents: student._id.toString() },
        $set: {
          status: newRoomData.residents.length === 1 ? "occupied" : "available",
        },
      },
    );

    // Create housing record
    const description =
      currentHouse && currentRoom
        ? `Student ${studentId} has been moved from ${currentHouse} - Room ${currentRoom} to ${newHouse} - Room ${newRoom}`
        : `Student ${studentId} has been assigned to ${newHouse} - Room ${newRoom}`;

    await housingRecordsCollection.insertOne({
      studentId,
      action: "moved",
      description,
      oldHouse: currentHouse || null,
      oldRoom: currentRoom || null,
      newHouse,
      newRoom,
      timestamp: new Date(),
      performedBy: req.body.performedBy || "admin",
    });

    // ✅ CREATE NOTIFICATION
    const moveMessage =
      currentHouse && currentRoom
        ? `You have been moved from ${currentHouse} - Room ${currentRoom} to ${newHouse} - Room ${newRoom}`
        : `You have been assigned to ${newHouse} - Room ${newRoom}`;

    await createNotification(
      student._id.toString(),
      student.username,
      "housing_moved",
      moveMessage,
    );

    res.json({ success: true, message: "Student moved successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to move student" });
  }
});

app.post("/deactivate-student-housing", async (req, res) => {
  try {
    const { studentId, house, roomNumber } = req.body;

    if (!studentId || !house || !roomNumber) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const housingCollection = db.collection("housing");
    const housingRecordsCollection = db.collection("student_housing_records");

    // Find the student to get their _id
    const student = await usersCollection.findOne({ studentId });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Find the room
    const room = await housingCollection.findOne({ house, roomNumber });

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Remove student from room
    await housingCollection.updateOne(
      { house, roomNumber },
      {
        $pull: { residents: student._id.toString() },
        $set: { status: room.residents.length <= 2 ? "available" : "occupied" },
      },
    );

    // Create housing record
    await housingRecordsCollection.insertOne({
      studentId,
      action: "deactivated",
      description: `Student ${studentId} has been removed from ${house} - Room ${roomNumber}`,
      house,
      roomNumber,
      timestamp: new Date(),
      performedBy: req.body.performedBy || "admin",
    });

    // ✅ CREATE NOTIFICATION
    await createNotification(
      student._id.toString(),
      student.username,
      "housing_deactivated",
      `Your housing assignment at ${house} - Room ${roomNumber} has been deactivated`,
    );

    res.json({
      success: true,
      message: "Student housing deactivated successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to deactivate student housing" });
  }
});

/* =========================
   Room Occupancy Overview
========================= */

app.get("/get-room-occupancy", async (req, res) => {
  try {
    const housingCollection = db.collection("housing");

    // Get all rooms with their residents
    const rooms = await housingCollection.find({}).toArray();

    // Get all students to map their info
    const students = await usersCollection
      .find({ userType: "student" })
      .toArray();

    // Create a map of student _id to student info
    const studentMap = {};
    students.forEach((student) => {
      studentMap[student._id.toString()] = {
        studentId: student.studentId,
        username: student.username,
        gender: student.gender,
        photo: student.photo || student.avatar,
      };
    });

    // Enhance rooms with resident details
    const roomsWithDetails = rooms.map((room) => ({
      house: room.house,
      roomNumber: room.roomNumber,
      status: room.status,
      capacity: 2,
      occupancy: room.residents.length,
      residents: room.residents.map(
        (residentId) =>
          studentMap[residentId] || {
            studentId: "Unknown",
            username: "Unknown",
          },
      ),
    }));

    // Group by house
    const adlamRooms = roomsWithDetails.filter(
      (r) => r.house === "Adlam House",
    );
    const nurseRooms = roomsWithDetails.filter((r) => r.house === "Nurse Home");

    res.json({
      adlamHouse: {
        totalRooms: 119,
        rooms: adlamRooms,
        occupied: adlamRooms.filter((r) => r.occupancy > 0).length,
        available: adlamRooms.filter((r) => r.occupancy === 0).length,
        full: adlamRooms.filter((r) => r.occupancy >= 2).length,
      },
      nurseHome: {
        totalRooms: 122,
        rooms: nurseRooms,
        occupied: nurseRooms.filter((r) => r.occupancy > 0).length,
        available: nurseRooms.filter((r) => r.occupancy === 0).length,
        full: nurseRooms.filter((r) => r.occupancy >= 2).length,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch room occupancy" });
  }
});

/* =========================
   Fault Reports Routes
========================= */

app.post("/add-fault-report", upload.single("image"), async (req, res) => {
  try {
    const { house, roomNumber, item, details, discoveryDate, reportedBy } =
      req.body;

    if (!house || !roomNumber || !item || !discoveryDate || !reportedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const faultReportsCollection = db.collection("fault_reports");

    // Generate fault report ID (e.g., FR-2026-001)
    const year = new Date().getFullYear();
    const count = await faultReportsCollection.countDocuments();
    const faultReportId = `FR-${year}-${String(count + 1).padStart(3, "0")}`;

    // Upload image to Cloudinary if provided
    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "fault_reports",
      });
      fs.unlinkSync(req.file.path);
      imageUrl = result.secure_url;
    }

    const result = await faultReportsCollection.insertOne({
      faultReportId,
      house,
      roomNumber,
      item,
      details: details || "",
      discoveryDate,
      reportedBy,
      imageUrl,
      status: "Pending",
      createdAt: new Date(),
    });

    res.json({ success: true, faultReportId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add fault report" });
  }
});

app.get("/get-fault-reports", async (req, res) => {
  try {
    const faultReportsCollection = db.collection("fault_reports");
    const reports = await faultReportsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch fault reports" });
  }
});

app.put("/update-fault-status", async (req, res) => {
  try {
    const { faultReportId, status } = req.body;

    if (!faultReportId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const faultReportsCollection = db.collection("fault_reports");

    const result = await faultReportsCollection.updateOne(
      { _id: new ObjectId(faultReportId) },
      { $set: { status, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Fault report not found" });
    }

    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

/* =========================
   Student Specific Records 
========================= */

// 1. Get Housing History for a specific student
app.get("/get-housing-history/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const housingRecordsCollection = db.collection("student_housing_records");

    // Find all movement logs for this specific student ID
    const history = await housingRecordsCollection
      .find({ studentId: studentId })
      .sort({ timestamp: -1 }) // Newest first
      .toArray();

    res.json(history);
  } catch (error) {
    console.error("Error fetching housing history:", error);
    res.status(500).json({ message: "Failed to fetch housing history" });
  }
});

// 2. Get Fault Reports for a specific room
// Used to show maintenance logs on the profile page
app.get("/get-room-faults/:house/:roomNumber", async (req, res) => {
  try {
    const { house, roomNumber } = req.params;
    const faultReportsCollection = db.collection("fault_reports");

    const reports = await faultReportsCollection
      .find({
        house: house,
        roomNumber: roomNumber,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json(reports);
  } catch (error) {
    console.error("Error fetching room faults:", error);
    res.status(500).json({ message: "Failed to fetch room maintenance logs" });
  }
});

/* =========================
   Rental Records Routes
========================= */

app.post("/add-rental-record", async (req, res) => {
  try {
    const { studentId, month, proofOfPaymentUrl, approvedBy, status } =
      req.body;

    if (!studentId || !month || !proofOfPaymentUrl || !approvedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const rentalRecordsCollection = db.collection("rental_records");

    // Check if record already exists for this student and month
    const existing = await rentalRecordsCollection.findOne({
      studentId,
      month,
    });

    if (existing) {
      return res
        .status(400)
        .json({ message: "Payment record already exists for this month" });
    }

    const result = await rentalRecordsCollection.insertOne({
      studentId,
      month,
      proofOfPaymentUrl,
      approvedBy,
      status: status || "Paid",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update user's rent status to Paid
    await usersCollection.updateOne(
      { studentId },
      { $set: { rentStatus: "Paid", lastPaymentDate: new Date() } },
    );

    // ✅ CREATE NOTIFICATION
    const student = await usersCollection.findOne({ studentId });
    if (student) {
      const monthName = new Date(month + "-01").toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      await createNotification(
        student._id.toString(),
        student.username,
        "rent_payment",
        `Your rent payment for ${monthName} has been recorded as ${status || "Paid"}`,
      );
    }

    res.json({ success: true, recordId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add rental record" });
  }
});

app.get("/get-rental-records/:studentId", async (req, res) => {
  try {
    const { studentId } = req.params;
    const rentalRecordsCollection = db.collection("rental_records");

    const records = await rentalRecordsCollection
      .find({ studentId })
      .sort({ month: -1 })
      .toArray();

    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch rental records" });
  }
});

/* =========================
   Attendance Routes
========================= */

app.post("/clock-in", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username required" });
    }

    const attendanceCollection = db.collection("attendance_records");

    // Check if user already clocked in today
    const today = new Date().toISOString().split("T")[0];
    const existingRecord = await attendanceCollection.findOne({
      username,
      date: today,
    });

    if (existingRecord && existingRecord.clockIn) {
      return res
        .status(400)
        .json({ message: "You have already clocked in today" });
    }

    const now = new Date();
    const clockInTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    // Determine status based on time (8:00 AM threshold)
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const isLate = hours > 8 || (hours === 8 && minutes > 0);

    const status = isLate ? "Late" : "Present";

    const result = await attendanceCollection.insertOne({
      username,
      date: today,
      clockIn: clockInTime,
      clockInTimestamp: now,
      clockOut: null,
      clockOutTimestamp: null,
      status,
      createdAt: now,
    });

    res.json({
      success: true,
      recordId: result.insertedId,
      clockInTime,
      status,
      message: `Clocked in successfully at ${clockInTime}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to clock in" });
  }
});

app.post("/clock-out", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ message: "Username required" });
    }

    const attendanceCollection = db.collection("attendance_records");

    // Find today's record
    const today = new Date().toISOString().split("T")[0];
    const record = await attendanceCollection.findOne({
      username,
      date: today,
    });

    if (!record) {
      return res
        .status(400)
        .json({ message: "No clock-in record found for today" });
    }

    if (record.clockOut) {
      return res
        .status(400)
        .json({ message: "You have already clocked out today" });
    }

    const now = new Date();
    const clockOutTime = now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    await attendanceCollection.updateOne(
      { _id: record._id },
      {
        $set: {
          clockOut: clockOutTime,
          clockOutTimestamp: now,
          updatedAt: now,
        },
      },
    );

    res.json({
      success: true,
      clockOutTime,
      message: `Clocked out successfully at ${clockOutTime}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to clock out" });
  }
});

app.get("/get-attendance/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { filter } = req.query; // 'week', 'month', '3months', 'all'

    if (!username) {
      return res.status(400).json({ message: "Username required" });
    }

    const attendanceCollection = db.collection("attendance_records");

    // Calculate date range based on filter
    let dateFilter = {};
    const today = new Date();

    if (filter === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      dateFilter = { date: { $gte: weekAgo.toISOString().split("T")[0] } };
    } else if (filter === "month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      dateFilter = { date: { $gte: monthAgo.toISOString().split("T")[0] } };
    } else if (filter === "3months") {
      const threeMonthsAgo = new Date(today);
      threeMonthsAgo.setMonth(today.getMonth() - 3);
      dateFilter = {
        date: { $gte: threeMonthsAgo.toISOString().split("T")[0] },
      };
    }

    const records = await attendanceCollection
      .find({ username, ...dateFilter })
      .sort({ date: -1 })
      .toArray();

    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch attendance records" });
  }
});

app.get("/get-attendance-status/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const attendanceCollection = db.collection("attendance_records");

    const today = new Date().toISOString().split("T")[0];
    const record = await attendanceCollection.findOne({
      username,
      date: today,
    });

    res.json({
      isClockedIn: record && record.clockIn && !record.clockOut,
      todayRecord: record || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to check attendance status" });
  }
});

/* =========================
   Employee Management Routes
========================= */

// 1. Get all users but filter for Employees/Staff only
app.get("/get-all-employees", async (req, res) => {
  try {
    // Filter: Fetch all users EXCEPT those with userType "student"

    const employees = await usersCollection
      .find({ userType: { $ne: "student" } })
      .sort({ username: 1 })
      .toArray();

    // Remove sensitive data (passwords) before sending
    const safeEmployees = employees.map((emp) => {
      const { hashedPassword, ...rest } = emp;
      return rest;
    });

    res.json(safeEmployees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch staff directory" });
  }
});

// 2. Get a single user by their MongoDB _id (used for routing to profiles)
app.get("/get-user-by-id/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid User ID format" });
    }

    const user = await usersCollection.findOne({ _id: new ObjectId(id) });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { hashedPassword, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 3. Get Staff Counts by Position (for the Stats Cards)
app.get("/get-staff-stats", async (req, res) => {
  try {
    const totalStaff = await usersCollection.countDocuments({
      userType: { $ne: "student" },
    });

    const adminRoles = ["Principal Tutor", "Head Matron", "Allocation Officer"];
    const admins = await usersCollection.countDocuments({
      position: { $in: adminRoles },
    });

    const wardens = await usersCollection.countDocuments({
      position: "Warden",
    });

    res.json({
      total: totalStaff,
      admins: admins,
      wardens: wardens,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// 4. Get Employee Timesheet with Duration
app.get("/get-employee-timesheet/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const attendanceCollection = db.collection("attendance_records");

    const records = await attendanceCollection
      .find({ username })
      .sort({ date: -1 })
      .limit(30) // Last 30 days
      .toArray();

    // Calculate duration for each record
    const enhancedRecords = records.map((record) => {
      let duration = "N/A";
      if (record.clockInTimestamp && record.clockOutTimestamp) {
        const diff =
          new Date(record.clockOutTimestamp) -
          new Date(record.clockInTimestamp);
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        duration = `${hours}h ${minutes}m`;
      }
      return { ...record, duration };
    });

    res.json(enhancedRecords);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch timesheet" });
  }
});

/* Check if student has paid for a specific month */
app.get("/check-rental-status/:studentId/:month", async (req, res) => {
  try {
    const { studentId, month } = req.params;
    const rentalRecordsCollection = db.collection("rental_records");

    const record = await rentalRecordsCollection.findOne({
      studentId,
      month,
    });

    res.json({
      hasPaid: !!record,
      record: record || null,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to check rental status" });
  }
});

/* =========================
   Facility Reports Routes
========================= */

app.post("/add-facility-report", upload.single("image"), async (req, res) => {
  try {
    const {
      dorm,
      facilityType,
      title,
      description,
      discoveryDate,
      reportedBy,
      status,
    } = req.body;

    if (!dorm || !facilityType || !title || !discoveryDate || !reportedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const facilityReportsCollection = db.collection("facilities_reports");

    // Generate facility report ID (e.g., FCR-2026-001)
    const year = new Date().getFullYear();
    const count = await facilityReportsCollection.countDocuments();
    const facilityReportId = `FCR-${year}-${String(count + 1).padStart(3, "0")}`;

    // Upload image to Cloudinary if provided
    let imageUrl = null;
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "facility_reports",
      });
      fs.unlinkSync(req.file.path);
      imageUrl = result.secure_url;
    }

    const result = await facilityReportsCollection.insertOne({
      facilityReportId,
      dorm,
      facilityType,
      title,
      description: description || "",
      discoveryDate,
      reportedBy,
      imageUrl,
      status: status || "Pending",
      createdAt: new Date(),
    });

    res.json({ success: true, facilityReportId: result.insertedId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add facility report" });
  }
});

app.get("/get-facility-reports", async (req, res) => {
  try {
    const facilityReportsCollection = db.collection("facilities_reports");
    const reports = await facilityReportsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(reports);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch facility reports" });
  }
});

app.put("/update-facility-report-status", async (req, res) => {
  try {
    const { facilityReportId, status } = req.body;

    if (!facilityReportId || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const facilityReportsCollection = db.collection("facilities_reports");

    const result = await facilityReportsCollection.updateOne(
      { _id: new ObjectId(facilityReportId) },
      { $set: { status, updatedAt: new Date() } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Facility report not found" });
    }

    res.json({ success: true, message: "Status updated successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update status" });
  }
});

/* =========================
   User Notifications Routes
========================= */

// Helper function to create a notification
async function createNotification(userId, username, notificationType, message) {
  try {
    const notificationsCollection = db.collection("user_notifications");

    await notificationsCollection.insertOne({
      userId,
      username,
      notificationType,
      message,
      timestamp: new Date(),
      read: false,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// Get notifications for a user
app.get("/get-notifications/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const notificationsCollection = db.collection("user_notifications");

    const notifications = await notificationsCollection
      .find({ username })
      .sort({ timestamp: -1 })
      .toArray();

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// Mark notification as read
app.put("/mark-notification-read/:notificationId", async (req, res) => {
  try {
    const { notificationId } = req.params;
    const notificationsCollection = db.collection("user_notifications");

    const result = await notificationsCollection.updateOne(
      { _id: new ObjectId(notificationId) },
      { $set: { read: true } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update notification" });
  }
});

/* =========================
   Password Reset Route
========================= */

app.post("/reset-password", async (req, res) => {
  try {
    const { staffId, email, position, newPassword, confirmPassword } = req.body;

    // Validate required fields
    if (!staffId || !email || !position || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    // Validate password length
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    // Find user with matching credentials
    const user = await usersCollection.findOne({
      staffId: staffId,
      email: email,
      position: position
    });

    // Check if user exists with matching credentials
    if (!user) {
      return res.status(404).json({ 
        message: "Invalid credentials. Please verify your Staff ID, Email, and Position." 
      });
    }

    // Hash the new password
    const hashedPassword = await encryptPassword(newPassword);

    // Update the password
    const result = await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { 
          hashedPassword: hashedPassword,
          passwordUpdatedAt: new Date()
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(500).json({ message: "Failed to update password" });
    }

    res.json({ 
      success: true, 
      message: "Password reset successfully" 
    });

  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Password reset failed" });
  }
});

/* =========================
   Server
========================= */

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`);
// });

startServer();

