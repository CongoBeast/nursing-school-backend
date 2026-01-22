// const express = require('express');
// const bodyParser = require('body-parser');
// const axios = require('axios');
// const cors = require('cors');
// const crypto = require('crypto');
// const moment = require('moment');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');


// const multer = require('multer');
// const { v2: cloudinary } = require('cloudinary');
// const dotenv = require('dotenv');
// const fs = require('fs');

// dotenv.config();

// const app = express();
// const PORT = 3001;
// app.use(express.json());

// const JWT_SECRET = 'your_jwt_secret'; // Use a strong, secret key in production

// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));
// // app.use(cors());
// app.use(cors({
//   origin: '*', // For development you can use '*', but specific URL is safer
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'api-key']
// }));

// const generateToken = (userId) => {
//     const secretKey = 'your-secret-key'; // Replace with your own secret key
//     const expiresIn = '1h'; // Token expiration time, e.g., 1 hour
//     const payload = { sub: userId,  iat: Math.floor(Date.now() / 1000), // Issued at time (current time in seconds)
//     };
//     return jwt.sign(payload, secretKey, { expiresIn });;
//   };

// cloudinary.config({
//   cloud_name: "dxxlrzouc",
//   api_key: "191187614991536",
//   api_secret: "9b75q3SXcar-yJFsWQsfXWFhnM8",
// });


// async function encryptPassword(password) {
//     try {
//       // Define the number of salt rounds
//       const saltRounds = 10;
  
//       // Generate the salt
//       const salt = await bcrypt.genSalt(saltRounds);
  
//       // Hash the password with the salt
//       const hashedPassword = await bcrypt.hash(password, salt);
  
//       console.log('Encrypted Password:', hashedPassword);
//       return hashedPassword;
//     } catch (error) {
//       console.error('Error encrypting password:', error);
//     }
//   }

// const generateId = () => {
//     return crypto.randomBytes(12).toString('hex'); // Generates a 24-character hexadecimal string
//   };

// const apiConfig = {
//     method: 'post',
//     headers: {
//       'Content-Type': 'application/json',
//       'Access-Control-Request-Headers': '*',
//       'api-key': '4graSqucDumhuePX7lpf75s6TrTFkwYXU1KN2h6vN3j72edWz6oue9BBFYOHvfUC',
//     },
//     urlBase: 'https://ap-south-1.aws.data.mongodb-api.com/app/data-nmutxbv/endpoint/data/v1/action/'
//   };

// const axiosInstance = axios.create({
//     baseURL: apiConfig.urlBase,
//     headers: apiConfig.headers,
//   });

//    const registerUser = async (userData) => {
//       try {
//         // Check if the username exists
//         let response = await axiosInstance.post('findOne', {
//           dataSource: 'Cluster0',
//           database: 'nursing-school',
//           collection: 'users',
//           filter: { username: userData.username },
//         });
    
//         if (response.data.document) {
//           return { status: 400, message: 'Username already exists' };
//         }
    
//         // Check if the email exists
//         response = await axiosInstance.post('findOne', {
//           dataSource: 'Cluster0',
//           database: 'nursing-school',
//           collection: 'users',
//           filter: { email: userData.email },
//         });
    
//         if (response.data.document) {
//           return { status: 400, message: 'Email already registered' };
//         }
    
//         const { hashedPassword, ...rest } = userData;
    
//         // Register the new user
//         response = await axiosInstance.post('insertOne', {
//           dataSource: 'Cluster0',
//           database: 'nursing-school',
//           collection: 'users',
//           document: {
//             ...rest,
//             hashedPassword: hashedPassword,
//             signupTimestamp: new Date(),
//           },
//         });
    
//         const token = generateToken();
    
//         return { status: 200, token };
//       } catch (error) {
//         console.error('Error registering user:', error);
//         return { status: 500, message: 'Internal server error' };
//       }
//     };


// app.post('/get-user', (req, res) => {
//     const { username } = req.body;
    

//     if (!username) {
//       return res.status(400).json({ error: 'UserId is required' });
//     }
  
//     const data = JSON.stringify({
//       collection: "users",
//       database: "nursing-school",
//       dataSource: "Cluster0",
//       filter: { "username": username },
//     });
  
//     axios({
//       ...apiConfig,
//       url: `${apiConfig.urlBase}find`,
//       data,
//     })
//       .then((response) => {
//         res.json(response.data.documents);
//         console.log(response.data.documents)
//       })
//       .catch((error) => {
//         console.error('Error:', error);
//         res.status(500).send(error);
//       });
//   });

//   app.post('/delete-user', (req, res) => {

//     const packageData = req.body;

//     const { filter, update } = packageData;

//     console.log(filter)
    
//     if (!filter._id) {
//       return res.status(400).json({ error: 'Missing _id for update.' });
//     }
  
//     const data = JSON.stringify({
//       collection: "users",
//       database: "nursing-school",
//       dataSource: "Cluster0",
//       filter: { 
//         "_id": { "$oid": filter._id } // Wrap the ID in $oid
//       },
//       update: { "$set": update }
//     });
  
//     axios({
//       ...apiConfig,
//       url: `${apiConfig.urlBase}updateOne`,
//       data
//     })
//       .then(response => {
//         res.json(response.data);
//       })
//       .catch(error => {
//         console.error('Error:', error.response?.data || error.message);
//         res.status(500).send(error);
//       });
//   });

  
//   app.post('/register', async (req, res) => {
//     try {
//       const userData = { ...req.body };
//       userData.hashedPassword = await encryptPassword(userData.password);
//       delete userData.password;
//       delete userData.confirmPassword;
  
//       const response = await registerUser(userData);
  
//       if (response.status === 200) {
//         res.json({ token: response.token });
//       } else {
//         res.status(response.status).json({ message: response.message });
//       }
//     } catch (err) {
//       console.error(err);
//       res.status(500).json({ message: 'Registration failed' });
//     }
//   });
  
//   // Login User
//   app.post('/login', (req, res) => {
//     const { username, password } = req.body;

//     // console.log(bcrypt.hash(password, 10))
  
//     const data = JSON.stringify({
//       "collection": "users",
//       "database": "nursing-school",
//       "dataSource": "Cluster0",
//       "filter": { username }
//     });
  
//     axios({ ...apiConfig, url: `${apiConfig.urlBase}findOne`, data })
//       .then(response => {
//         const user = response.data.document;

//         console.log(user.hashedPassword)
//         if (user && bcrypt.compareSync(password, user.hashedPassword)) {
//           const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });
  
//           // Update user's loggedOn status and loginTimestamp
//           const loginTimestamp = new Date().toISOString();
//           const updateData = JSON.stringify({
//             "collection": "users",
//             "database": "nursing-school",
//             "dataSource": "Cluster0",
//             "filter": { "_id": user._id },
//             "update": { "$set": { isLoggedOn: true, loginTimestamp } }
//           });
  
//           axios({ ...apiConfig, url: `${apiConfig.urlBase}updateOne`, data: updateData })
//             .then(() => res.json({ token }))
//             .catch(error => res.status(500).send(error));
  
//         } else {
//           res.status(401).send('Invalid credentials');
//         }
//       })
//       .catch(error => res.status(500).send(error));
//   });  

//     // Multer setup to store files temporarily
// const upload = multer({ dest: 'uploads/' });

// // Upload route
// app.post('/upload', upload.single('image'), async (req, res) => {
//   try {
//     const filePath = req.file.path;

//     // Upload to Cloudinary
//     const result = await cloudinary.uploader.upload(filePath, {
//       folder: 'chat_avatars', // Optional: target folder in Cloudinary
//     });

//     // Remove temp file
//     fs.unlinkSync(filePath);

//     res.json({ success: true, url: result.secure_url });
//   } catch (error) {
//     console.error('Upload error:', error);
//     res.status(500).json({ success: false, message: 'Image upload failed.' });
//   }
// });
  
  
//   app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
//   });

  
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
   User Management
========================= */

app.post('/get-user', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    const user = await usersCollection.find({ username }).toArray();
    res.json(user);

  } catch (error) {
    console.error(error);
    res.status(500).send(error);
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

/* =========================
   Health Check / Test Route
========================= */

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'Server is running normally',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    mongodb: db ? 'connected' : 'disconnected'
  });
});

app.get('/test', async (req, res) => {
  try {
    // Test MongoDB connection
    await db.admin().ping();
    
    res.json({
      status: 'success',
      server: 'running',
      mongodb: 'connected',
      database: db.databaseName,
      timestamp: new Date().toISOString(),
      cors: {
        enabled: true,
        allowedOrigins: [
          'http://localhost:3000',
          'https://nursing-school-frontend.vercel.app'
        ]
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message,
      mongodb: 'disconnected'
    });
  }
});

// Test CORS specifically
app.post('/test-cors', (req, res) => {
  res.json({
    status: 'success',
    message: 'CORS is working - POST request successful',
    receivedData: req.body,
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent']
    }
  });
});
```

## How to Test:

### 1. **Test from browser (GET request):**
```
https://nursing-school-backend.vercel.app/health

startServer();




