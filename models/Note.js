const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: [true, 'Note title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: { 
    type: String, 
    required: [true, 'Note content is required'],
    maxlength: [50000, 'Content cannot exceed 50,000 characters']
  },
  summary: {
    type: String,
    maxlength: [500, 'Summary cannot exceed 500 characters']
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Author is required'] 
  },
  authorName: { 
    type: String, 
    required: [true, 'Author name is required'] 
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  category: {
    type: String,
    trim: true,
    enum: [
      'Mathematics',
      'Science',
      'History',
      'Literature',
      'Technology',
      'Business',
      'Engineering',
      'Medicine',
      'Arts',
      'Language',
      'Philosophy',
      'Psychology',
      'Other'
    ]
  },
  subject: {
    type: String,
    trim: true,
    maxlength: [100, 'Subject cannot exceed 100 characters']
  },
  difficulty: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    default: 'Intermediate'
  },
  isPublic: { type: Boolean, default: true },
  isPinned: { type: Boolean, default: false }, // For author to pin important notes
  files: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'File' 
  }],
  
  // Engagement metrics
  downloadCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0, min: 0, max: 5 },
  ratingCount: { type: Number, default: 0 },
  
  // Comments/Reviews system
  reviews: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String,
    rating: { type: Number, min: 1, max: 5 },
    comment: { type: String, maxlength: [500, 'Comment cannot exceed 500 characters'] },
    createdAt: { type: Date, default: Date.now }
  }],
  
  // Favorites/Bookmarks
  favoritedBy: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  
  // Version control
  version: { type: Number, default: 1 },
  previousVersions: [{
    version: Number,
    title: String,
    content: String,
    updatedAt: Date,
    changeDescription: String
  }],
  
  // Status and workflow
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'published'
  },
  
  // SEO and metadata
  slug: { type: String, unique: true, sparse: true },
  metaDescription: { type: String, maxlength: [160, 'Meta description too long'] },
  keywords: [String],
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  publishedAt: { type: Date },
  lastViewedAt: { type: Date }
});

// Indexes for better performance
noteSchema.index({ author: 1, createdAt: -1 });
noteSchema.index({ isPublic: 1, createdAt: -1 });
noteSchema.index({ category: 1, createdAt: -1 });
noteSchema.index({ tags: 1 });
noteSchema.index({ title: 'text', content: 'text', tags: 'text' });
noteSchema.index({ rating: -1, ratingCount: -1 });
noteSchema.index({ downloadCount: -1 });
noteSchema.index({ slug: 1 });
noteSchema.index({ status: 1, isPublic: 1 });

// Pre-save middleware
noteSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Generate slug from title if not provided
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
    
    // Add timestamp to ensure uniqueness
    this.slug += '-' + Date.now();
  }
  
  // Auto-generate summary if not provided
  if (!this.summary && this.content) {
    this.summary = this.content.substring(0, 200) + (this.content.length > 200 ? '...' : '');
  }
  
  // Set published date for new published notes
  if (this.status === 'published' && !this.publishedAt) {
    this.publishedAt = Date.now();
  }
  
  next();
});

// Virtual for favorite count
noteSchema.virtual('favoriteCount').get(function() {
  return this.favoritedBy ? this.favoritedBy.length : 0;
});

// Virtual for average rating (formatted)
noteSchema.virtual('averageRating').get(function() {
  return this.ratingCount > 0 ? Math.round(this.rating * 10) / 10 : 0;
});

// Virtual for reading time estimate
noteSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Instance methods
noteSchema.methods.addRating = async function(userId, username, rating, comment = '') {
  // Check if user already rated
  const existingReview = this.reviews.find(review => 
    review.user && review.user.toString() === userId.toString()
  );
  
  if (existingReview) {
    // Update existing rating
    const oldRating = existingReview.rating;
    existingReview.rating = rating;
    existingReview.comment = comment;
    
    // Recalculate average
    const totalRating = (this.rating * this.ratingCount) - oldRating + rating;
    this.rating = totalRating / this.ratingCount;
  } else {
    // Add new rating
    this.reviews.push({
      user: userId,
      username: username,
      rating: rating,
      comment: comment
    });
    
    // Recalculate average
    const totalRating = (this.rating * this.ratingCount) + rating;
    this.ratingCount += 1;
    this.rating = totalRating / this.ratingCount;
  }
  
  return this.save();
};

noteSchema.methods.incrementView = async function() {
  this.viewCount += 1;
  this.lastViewedAt = Date.now();
  return this.save({ validateBeforeSave: false });
};

noteSchema.methods.incrementDownload = async function() {
  this.downloadCount += 1;
  return this.save({ validateBeforeSave: false });
};

noteSchema.methods.toggleFavorite = async function(userId) {
  const index = this.favoritedBy.indexOf(userId);
  if (index > -1) {
    this.favoritedBy.splice(index, 1);
  } else {
    this.favoritedBy.push(userId);
  }
  return this.save();
};

noteSchema.methods.createVersion = async function(changeDescription = 'Updated note') {
  // Store current version in history
  this.previousVersions.push({
    version: this.version,
    title: this.title,
    content: this.content,
    updatedAt: this.updatedAt,
    changeDescription: changeDescription
  });
  
  // Increment version
  this.version += 1;
  
  return this.save();
};

// Static methods
noteSchema.statics.findPublished = function(options = {}) {
  const { category, tags, author, limit = 20, page = 1 } = options;
  
  let query = { status: 'published', isPublic: true };
  
  if (category) query.category = category;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  if (author) query.author = author;
  
  return this.find(query)
    .populate('author', 'username profile.firstName profile.lastName')
    .populate('files', 'originalName mimetype size')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip((page - 1) * limit);
};

noteSchema.statics.findPopular = function(timeframe = 'all', limit = 10) {
  let dateFilter = {};
  
  if (timeframe === 'week') {
    dateFilter.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  } else if (timeframe === 'month') {
    dateFilter.createdAt = { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) };
  }
  
  return this.find({ 
    status: 'published', 
    isPublic: true,
    ...dateFilter 
  })
    .populate('author', 'username profile.firstName profile.lastName')
    .populate('files', 'originalName mimetype size')
    .sort({ downloadCount: -1, rating: -1, viewCount: -1 })
    .limit(limit);
};

noteSchema.statics.searchNotes = function(searchTerm, options = {}) {
  const { category, tags, limit = 20, page = 1 } = options;
  
  let query = {
    status: 'published',
    isPublic: true,
    $text: { $search: searchTerm }
  };
  
  if (category) query.category = category;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  
  return this.find(query, { score: { $meta: "textScore" } })
    .populate('author', 'username profile.firstName profile.lastName')
    .populate('files', 'originalName mimetype size')
    .sort({ score: { $meta: "textScore" } })
    .limit(limit)
    .skip((page - 1) * limit);
};

module.exports = mongoose.model('Note', noteSchema);
