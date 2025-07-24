const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  filename: { 
    type: String, 
    required: [true, 'Filename is required'] 
  },
  originalName: { 
    type: String, 
    required: [true, 'Original filename is required'] 
  },
  mimetype: { 
    type: String, 
    required: [true, 'File mimetype is required'],
    enum: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
  },
  size: { 
    type: Number, 
    required: [true, 'File size is required'],
    max: [10 * 1024 * 1024, 'File size cannot exceed 10MB'] // 10MB limit
  },
  path: { 
    type: String, 
    required: [true, 'File path is required'] 
  },
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: [true, 'Uploader is required'] 
  },
  description: { 
    type: String, 
    maxlength: [200, 'Description cannot exceed 200 characters'] 
  },
  tags: [{ 
    type: String, 
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  isPublic: { type: Boolean, default: true },
  downloadCount: { type: Number, default: 0 },
  metadata: {
    width: Number, // For images
    height: Number, // For images
    pages: Number, // For PDFs
    duration: Number // For videos (if you add video support later)
  },
  checksum: String, // For file integrity verification
  uploadedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better performance
fileSchema.index({ uploadedBy: 1, uploadedAt: -1 });
fileSchema.index({ mimetype: 1 });
fileSchema.index({ originalName: 'text', description: 'text' });
fileSchema.index({ tags: 1 });
fileSchema.index({ isPublic: 1, uploadedAt: -1 });

// Pre-save middleware to update timestamps
fileSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Virtual for file type category
fileSchema.virtual('category').get(function() {
  if (this.mimetype.startsWith('image/')) return 'image';
  if (this.mimetype === 'application/pdf') return 'pdf';
  if (this.mimetype.includes('word') || this.mimetype.includes('document')) return 'document';
  if (this.mimetype === 'text/plain') return 'text';
  return 'other';
});

// Virtual for human readable file size
fileSchema.virtual('humanReadableSize').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
});

// Instance method to increment download count
fileSchema.methods.incrementDownload = async function() {
  this.downloadCount += 1;
  return this.save();
};

// Static method to get files by type
fileSchema.statics.findByType = function(mimetype, limit = 10) {
  return this.find({ mimetype, isPublic: true })
    .sort({ uploadedAt: -1 })
    .limit(limit)
    .populate('uploadedBy', 'username');
};

// Static method to get popular files
fileSchema.statics.findPopular = function(limit = 10) {
  return this.find({ isPublic: true })
    .sort({ downloadCount: -1, uploadedAt: -1 })
    .limit(limit)
    .populate('uploadedBy', 'username');
};

module.exports = mongoose.model('File', fileSchema);
