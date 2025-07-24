const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();
console.log('MONGODB_URI:', process.env.MONGODB_URI);


const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// MongoDB Atlas connection

mongoose.connect(process.env.MONGODB_URI)
.then(() => {
  console.log('Connected to MongoDB Atlas successfully');
}).catch((error) => {
  console.error('MongoDB Atlas connection error:', error);
  process.exit(1);
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// File Schema
const fileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  mimetype: { type: String, required: true },
  size: { type: Number, required: true },
  path: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedAt: { type: Date, default: Date.now }
});

// Note Schema
const noteSchema = new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  tags: [String],
  category: String,
  isPublic: { type: Boolean, default: true },
  files: [{ type: mongoose.Schema.Types.ObjectId, ref: 'File' }],
  downloadCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0 },
  ratingCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const File = mongoose.model('File', fileSchema);
const Note = mongoose.model('Note', noteSchema);

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, images, text, and Word documents are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// JWT middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = new User({
      username,
      email,
      password: hashedPassword
    });
    
    await user.save();
    
    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET || 'your-secret-key');
    
    res.json({
      message: 'Login successful',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// File upload endpoint
app.post('/api/upload', authenticateToken, upload.array('files', 5), async (req, res) => {
  try {
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const newFile = new File({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        path: file.path,
        uploadedBy: req.user.userId
      });
      
      await newFile.save();
      uploadedFiles.push(newFile);
    }
    
    res.json({
      message: 'Files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    res.status(500).json({ message: 'File upload failed', error: error.message });
  }
});

// Create note
app.post('/api/notes', authenticateToken, async (req, res) => {
  try {
    const { title, content, tags, category, isPublic, fileIds } = req.body;
    
    const note = new Note({
      title,
      content,
      author: req.user.userId,
      authorName: req.user.username,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      category,
      isPublic: isPublic !== undefined ? isPublic : true,
      files: fileIds || []
    });
    
    await note.save();
    await note.populate('files');
    
    res.status(201).json({ message: 'Note created successfully', note });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get all public notes
app.get('/api/notes', authenticateToken, async (req, res) => {
  try {
    const { search, category, tags } = req.query;
    let query = { isPublic: true };
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (tags) {
      query.tags = { $in: tags.split(',') };
    }
    
    const notes = await Note.find(query)
      .sort({ createdAt: -1 })
      .populate('author', 'username')
      .populate('files');
    
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's notes
app.get('/api/my-notes', authenticateToken, async (req, res) => {
  try {
    const notes = await Note.find({ author: req.user.userId })
      .sort({ createdAt: -1 })
      .populate('files');
    
    res.json(notes);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get single note
app.get('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('author', 'username')
      .populate('files');
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    if (!note.isPublic && note.author._id.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.json(note);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update note
app.put('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    if (note.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { title, content, tags, category, isPublic, fileIds } = req.body;
    
    note.title = title || note.title;
    note.content = content || note.content;
    note.tags = tags ? tags.split(',').map(tag => tag.trim()) : note.tags;
    note.category = category || note.category;
    note.isPublic = isPublic !== undefined ? isPublic : note.isPublic;
    note.files = fileIds || note.files;
    note.updatedAt = Date.now();
    
    await note.save();
    await note.populate('files');
    
    res.json({ message: 'Note updated successfully', note });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete note
app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    if (note.author.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    for (const fileId of note.files) {
      const file = await File.findById(fileId);
      if (file) {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
        await File.findByIdAndDelete(fileId);
      }
    }
    
    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download file
app.get('/api/files/:id/download', authenticateToken, async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    if (!fs.existsSync(file.path)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    res.download(file.path, file.originalName);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Download note
app.post('/api/notes/:id/download', authenticateToken, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (note) {
      note.downloadCount += 1;
      await note.save();
    }
    res.json({ message: 'Download counted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Rate note
app.post('/api/notes/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { rating } = req.body;
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    const newTotal = (note.rating * note.ratingCount) + rating;
    note.ratingCount += 1;
    note.rating = newTotal / note.ratingCount;
    
    await note.save();
    res.json({ message: 'Rating added successfully', rating: note.rating });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user files
app.get('/api/my-files', authenticateToken, async (req, res) => {
  try {
    const files = await File.find({ uploadedBy: req.user.userId })
      .sort({ uploadedAt: -1 });
    
    res.json(files);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Protected route
app.get('/', (req, res) => {
  res.redirect('/login.html');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
