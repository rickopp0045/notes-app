// Dashboard functionality with file upload

let uploadedFileIds = [];

document.addEventListener('DOMContentLoaded', function() {
    // Check authentication
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    // Display user welcome message
    const userWelcome = document.getElementById('userWelcome');
    if (userWelcome) {
        userWelcome.textContent = `Welcome, ${user.username}!`;
    }
    
    // Form handlers
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        noteForm.addEventListener('submit', handleCreateNote);
    }
    
    const editNoteForm = document.getElementById('editNoteForm');
    if (editNoteForm) {
        editNoteForm.addEventListener('submit', handleEditNote);
    }
    
    // File upload handlers
    const fileUpload = document.getElementById('fileUpload');
    if (fileUpload) {
        fileUpload.addEventListener('change', handleFileUpload);
    }
    
    const editFileUpload = document.getElementById('editFileUpload');
    if (editFileUpload) {
        editFileUpload.addEventListener('change', handleEditFileUpload);
    }
    
    // Load user's notes
    loadMyNotes();
    
    // Modal handlers
    setupModals();
});

async function handleFileUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    
    const token = localStorage.getItem('token');
    const progressDiv = document.getElementById('uploadProgress');
    const uploadedFilesDiv = document.getElementById('uploadedFiles');
    
    try {
        progressDiv.style.display = 'block';
        progressDiv.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div><p>Uploading files...</p>';
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            progressDiv.innerHTML = '<p style="color: green;">✅ Files uploaded successfully!</p>';
            
            // Store uploaded file IDs
            uploadedFileIds = [...uploadedFileIds, ...data.files.map(f => f._id)];
            
            // Display uploaded files
            displayUploadedFiles(data.files, uploadedFilesDiv);
            
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);
        } else {
            progressDiv.innerHTML = `<p style="color: red;">❌ Upload failed: ${data.message}</p>`;
        }
    } catch (error) {
        progressDiv.innerHTML = '<p style="color: red;">❌ Upload failed. Please try again.</p>';
    }
}

async function handleEditFileUpload(event) {
    const files = event.target.files;
    if (files.length === 0) return;
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    
    const token = localStorage.getItem('token');
    const progressDiv = document.getElementById('editUploadProgress');
    const uploadedFilesDiv = document.getElementById('editUploadedFiles');
    
    try {
        progressDiv.style.display = 'block';
        progressDiv.innerHTML = '<div class="progress-bar"><div class="progress-fill" style="width: 0%"></div></div><p>Uploading files...</p>';
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (response.ok) {
            progressDiv.innerHTML = '<p style="color: green;">✅ Files uploaded successfully!</p>';
            
            // Store uploaded file IDs
            const currentFileIds = document.getElementById('editNoteId').dataset.fileIds ? 
                JSON.parse(document.getElementById('editNoteId').dataset.fileIds) : [];
            const newFileIds = [...currentFileIds, ...data.files.map(f => f._id)];
            document.getElementById('editNoteId').dataset.fileIds = JSON.stringify(newFileIds);
            
            // Display uploaded files
            displayUploadedFiles(data.files, uploadedFilesDiv);
            
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);
        } else {
            progressDiv.innerHTML = `<p style="color: red;">❌ Upload failed: ${data.message}</p>`;
        }
    } catch (error) {
        progressDiv.innerHTML = '<p style="color: red;">❌ Upload failed. Please try again.</p>';
    }
}

function displayUploadedFiles(files, container) {
    files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.innerHTML = `
            <div class="file-info">
                <span class="file-icon">${getFileIcon(file.mimetype)}</span>
                <div class="file-details">
                    <div class="file-name">${file.originalName}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-actions">
                <button onclick="removeUploadedFile('${file._id}', this)" class="btn btn-danger">Remove</button>
            </div>
        `;
        container.appendChild(fileDiv);
    });
}

function removeUploadedFile(fileId, button) {
    // Remove from uploaded file IDs
    uploadedFileIds = uploadedFileIds.filter(id => id !== fileId);
    
    // Remove from UI
    button.closest('.file-item').remove();
    
    showMessage('File removed from note', 'success');
}

async function handleCreateNote(e) {
    e.preventDefault();
    
    const title = document.getElementById('noteTitle').value;
    const content = document.getElementById('noteContent').value;
    const category = document.getElementById('noteCategory').value;
    const tags = document.getElementById('noteTags').value;
    const isPublic = document.getElementById('isPublic').checked;
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/notes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                content,
                category,
                tags,
                isPublic,
                fileIds: uploadedFileIds
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Note created successfully!', 'success');
            document.getElementById('noteForm').reset();
            document.getElementById('uploadedFiles').innerHTML = '';
            uploadedFileIds = [];
            loadMyNotes(); // Refresh the notes list
        } else {
            showMessage(data.message || 'Failed to create note', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

async function loadMyNotes() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/my-notes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const notes = await response.json();
        
        if (response.ok) {
            displayMyNotes(notes);
        } else {
            showMessage('Failed to load notes', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

function displayMyNotes(notes) {
    const notesGrid = document.getElementById('myNotesGrid');
    
    if (notes.length === 0) {
        notesGrid.innerHTML = '<p class="text-center">You haven\'t created any notes yet.</p>';
        return;
    }
    
    notesGrid.innerHTML = notes.map(note => `
        <div class="note-card">
            <h3>${note.title}</h3>
            <div class="note-meta">
                ${formatDate(note.createdAt)} • ${note.category || 'Uncategorized'}
            </div>
            <div class="note-content-preview">${truncateText(note.content, 150)}</div>
            ${note.tags.length > 0 ? `
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            ${note.files && note.files.length > 0 ? `
                <div class="note-files">
                    <strong>📎 ${note.files.length} file(s) attached</strong>
                </div>
            ` : ''}
            <div class="note-stats">
                <span>📥 ${note.downloadCount} downloads</span>
                <span>${note.isPublic ? '🌐 Public' : '🔒 Private'}</span>
            </div>
            <div class="note-actions">
                <button onclick="editNote('${note._id}')" class="btn btn-secondary">Edit</button>
                <button onclick="deleteNote('${note._id}')" class="btn btn-danger">Delete</button>
                <button onclick="viewNote('${note._id}')" class="btn btn-primary">View</button>
            </div>
        </div>
    `).join('');
}

async function editNote(noteId) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const note = await response.json();
        
        if (response.ok) {
            // Populate edit form
            document.getElementById('editNoteId').value = note._id;
            document.getElementById('editNoteId').dataset.fileIds = JSON.stringify(note.files.map(f => f._id));
            document.getElementById('editTitle').value = note.title;
            document.getElementById('editCategory').value = note.category || '';
            document.getElementById('editTags').value = note.tags.join(', ');
            document.getElementById('editContent').value = note.content;
            document.getElementById('editIsPublic').checked = note.isPublic;
            
            // Display existing files
            displayExistingFiles(note.files);
            
            // Clear upload areas
            document.getElementById('editUploadedFiles').innerHTML = '';
            document.getElementById('editUploadProgress').style.display = 'none';
            
            // Show modal
            document.getElementById('editModal').style.display = 'block';
        } else {
            showMessage('Failed to load note for editing', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

function displayExistingFiles(files) {
    const existingFilesList = document.getElementById('existingFilesList');
    
    if (files.length === 0) {
        existingFilesList.innerHTML = '<p>No files attached to this note.</p>';
        return;
    }
    
    existingFilesList.innerHTML = files.map(file => `
        <div class="existing-file-item">
            <div class="existing-file-info">
                <span class="file-icon">${getFileIcon(file.mimetype)}</span>
                <div class="file-details">
                    <div class="file-name">${file.originalName}</div>
                    <div class="file-size">${formatFileSize(file.size)}</div>
                </div>
            </div>
            <div class="file-actions">
                <button onclick="downloadFile('${file._id}', '${file.originalName}')" class="btn btn-primary">Download</button>
                <button onclick="removeExistingFile('${file._id}', this)" class="btn btn-danger">Remove</button>
            </div>
        </div>
    `).join('');
}

function removeExistingFile(fileId, button) {
    const editNoteIdField = document.getElementById('editNoteId');
    let currentFileIds = JSON.parse(editNoteIdField.dataset.fileIds || '[]');
    currentFileIds = currentFileIds.filter(id => id !== fileId);
    editNoteIdField.dataset.fileIds = JSON.stringify(currentFileIds);
    
    button.closest('.existing-file-item').remove();
    showMessage('File will be removed when note is updated', 'success');
}

async function handleEditNote(e) {
    e.preventDefault();
    
    const noteId = document.getElementById('editNoteId').value;
    const title = document.getElementById('editTitle').value;
    const content = document.getElementById('editContent').value;
    const category = document.getElementById('editCategory').value;
    const tags = document.getElementById('editTags').value;
    const isPublic = document.getElementById('editIsPublic').checked;
    const fileIds = JSON.parse(document.getElementById('editNoteId').dataset.fileIds || '[]');
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                title,
                content,
                category,
                tags,
                isPublic,
                fileIds
            }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Note updated successfully!', 'success');
            document.getElementById('editModal').style.display = 'none';
            loadMyNotes(); // Refresh the notes list
        } else {
            showMessage(data.message || 'Failed to update note', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

async function deleteNote(noteId) {
    if (!confirm('Are you sure you want to delete this note? This will also delete all attached files.')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Note deleted successfully!', 'success');
            loadMyNotes(); // Refresh the notes list
        } else {
            showMessage(data.message || 'Failed to delete note', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

async function viewNote(noteId) {
    window.open(`/note/${noteId}`, '_blank');
}

async function loadMyFiles() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/my-files', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const files = await response.json();
        
        if (response.ok) {
            displayMyFiles(files);
        } else {
            showMessage('Failed to load files', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

function displayMyFiles(files) {
    const filesGrid = document.getElementById('myFilesGrid');
    
    if (files.length === 0) {
        filesGrid.innerHTML = '<p class="text-center">You haven\'t uploaded any files yet.</p>';
        return;
    }
    
    filesGrid.innerHTML = files.map(file => `
        <div class="file-card">
            <div class="file-card-header">
                <span class="file-card-icon ${getFileClass(file.mimetype)}">${getFileIcon(file.mimetype)}</span>
                <div class="file-card-info">
                    <h4>${file.originalName}</h4>
                    <div class="file-card-meta">${formatFileSize(file.size)} • ${formatDate(file.uploadedAt)}</div>
                </div>
            </div>
            <div class="file-card-actions">
                <button onclick="downloadFile('${file._id}', '${file.originalName}')" class="btn btn-primary">Download</button>
            </div>
        </div>
    `).join('');
}

async function downloadFile(fileId, filename) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/files/${fileId}/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            
            showMessage('File downloaded successfully!', 'success');
        } else {
            showMessage('Failed to download file', 'error');
        }
    } catch (error) {
        showMessage('Download failed. Please try again.', 'error');
    }
}

function showTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    if (tabName === 'create') {
        document.getElementById('createTab').classList.add('active');
        document.querySelector('[onclick="showTab(\'create\')"]').classList.add('active');
    } else if (tabName === 'my-notes') {
        document.getElementById('myNotesTab').classList.add('active');
        document.querySelector('[onclick="showTab(\'my-notes\')"]').classList.add('active');
        loadMyNotes();
    } else if (tabName === 'my-files') {
        document.getElementById('myFilesTab').classList.add('active');
        document.querySelector('[onclick="showTab(\'my-files\')"]').classList.add('active');
        loadMyFiles();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

function setupModals() {
    // Close modal when clicking the X
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(btn => {
        btn.onclick = function() {
            this.closest('.modal').style.display = 'none';
        }
    });
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    }
}

// Utility functions
function getFileIcon(mimetype) {
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('image')) return '🖼️';
    if (mimetype.includes('text')) return '📝';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📃';
    return '📁';
}

function getFileClass(mimetype) {
    if (mimetype.includes('pdf')) return 'file-pdf';
    if (mimetype.includes('image')) return 'file-image';
    if (mimetype.includes('text')) return 'file-text';
    if (mimetype.includes('word') || mimetype.includes('document')) return 'file-doc';
    return 'file-default';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function showMessage(message, type) {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(messageDiv, container.firstChild);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}
