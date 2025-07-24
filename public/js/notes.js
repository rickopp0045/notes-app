// Notes browsing functionality with authentication

document.addEventListener('DOMContentLoaded', function() {
    checkAuthentication();
});

function checkAuthentication() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!token) {
        document.getElementById('loginRequired').style.display = 'flex';
        document.getElementById('mainContent').style.display = 'none';
        return;
    }
    
    document.getElementById('loginRequired').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
    
    // Display user welcome message
    const userWelcome = document.getElementById('userWelcome');
    if (userWelcome) {
        userWelcome.textContent = `Welcome, ${user.username}!`;
    }
    
    loadNotes();
    setupModal();
}

async function loadNotes(searchParams = {}) {
    const token = localStorage.getItem('token');
    
    try {
        const queryString = new URLSearchParams(searchParams).toString();
        const url = `/api/notes${queryString ? '?' + queryString : ''}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        const notes = await response.json();
        
        if (response.ok) {
            displayNotes(notes);
        } else {
            showMessage('Failed to load notes', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

function displayNotes(notes) {
    const notesGrid = document.getElementById('notesGrid');
    
    if (notes.length === 0) {
        notesGrid.innerHTML = '<p class="text-center">No notes found.</p>';
        return;
    }
    
    notesGrid.innerHTML = notes.map(note => `
        <div class="note-card" onclick="openNote('${note._id}')">
            <h3>${note.title}</h3>
            <div class="note-meta">
                By ${note.authorName} • ${formatDate(note.createdAt)} • ${note.category || 'Uncategorized'}
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
                <div class="rating">
                    <span class="stars">${'★'.repeat(Math.round(note.rating))}</span>
                    <span>(${note.ratingCount})</span>
                </div>
            </div>
        </div>
    `).join('');
}

async function openNote(noteId) {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/notes/${noteId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 401) {
            logout();
            return;
        }
        
        const note = await response.json();
        
        if (response.ok) {
            displayNoteModal(note);
        } else {
            showMessage('Failed to load note', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

function displayNoteModal(note) {
    const noteContent = document.getElementById('noteContent');
    noteContent.innerHTML = `
        <h2>${note.title}</h2>
        <div class="note-meta">
            By ${note.authorName} • ${formatDate(note.createdAt)} • ${note.category || 'Uncategorized'}
        </div>
        ${note.tags.length > 0 ? `
            <div class="note-tags">
                ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>
        ` : ''}
        <div class="note-content" style="margin: 2rem 0; line-height: 1.6;">
            ${note.content.replace(/\n/g, '<br>')}
        </div>
        ${note.files && note.files.length > 0 ? `
            <div class="note-files">
                <h4>📎 Attached Files:</h4>
                <div class="note-file-list">
                    ${note.files.map(file => `
                        <div class="note-file-item" onclick="downloadFile('${file._id}', '${file.originalName}')">
                            <span class="note-file-icon">${getFileIcon(file.mimetype)}</span>
                            <span class="note-file-name">${file.originalName}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        <div class="note-actions">
            <button onclick="downloadNote('${note._id}', '${note.title}')" class="btn btn-primary">Download Note</button>
            <button onclick="rateNote('${note._id}')" class="btn btn-secondary">Rate Note</button>
        </div>
        <div class="note-stats" style="margin-top: 1rem;">
            <span>📥 ${note.downloadCount} downloads</span>
            <div class="rating">
                <span class="stars">${'★'.repeat(Math.round(note.rating))}</span>
                <span>(${note.ratingCount} ratings)</span>
            </div>
        </div>
    `;
    
    document.getElementById('noteModal').style.display = 'block';
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

async function downloadNote(noteId, title) {
    const token = localStorage.getItem('token');
    
    try {
        // Increment download count
        await fetch(`/api/notes/${noteId}/download`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        // Get note content for download
        const response = await fetch(`/api/notes/${noteId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const note = await response.json();
        
        if (response.ok) {
            // Create downloadable content
            const content = `Title: ${note.title}\nAuthor: ${note.authorName}\nDate: ${formatDate(note.createdAt)}\nCategory: ${note.category || 'Uncategorized'}\nTags: ${note.tags.join(', ')}\n\n${note.content}\n\nAttached Files: ${note.files.length} file(s)`;
            
            // Create and trigger download
            const blob = new Blob([content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            showMessage('Note downloaded successfully!', 'success');
            
            // Reload notes to update download count
            loadNotes();
        }
    } catch (error) {
        showMessage('Download failed. Please try again.', 'error');
    }
}

async function rateNote(noteId) {
    const rating = prompt('Rate this note (1-5 stars):');
    
    if (rating === null || rating === '') return;
    
    const ratingNum = parseInt(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
        showMessage('Please enter a valid rating between 1 and 5', 'error');
        return;
    }
    
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch(`/api/notes/${noteId}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ rating: ratingNum })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage('Rating submitted successfully!', 'success');
            // Refresh the note display
            openNote(noteId);
            loadNotes();
        } else {
            showMessage(data.message || 'Failed to submit rating', 'error');
        }
    } catch (error) {
        showMessage('Network error. Please try again.', 'error');
    }
}

function searchNotes() {
    const search = document.getElementById('searchInput').value;
    const category = document.getElementById('categoryFilter').value;
    const tags = document.getElementById('tagsFilter').value;
    
    const searchParams = {};
    
    if (search) searchParams.search = search;
    if (category) searchParams.category = category;
    if (tags) searchParams.tags = tags;
    
    loadNotes(searchParams);
}

function getFileIcon(mimetype) {
    if (mimetype.includes('pdf')) return '📄';
    if (mimetype.includes('image')) return '🖼️';
    if (mimetype.includes('text')) return '📝';
    if (mimetype.includes('word') || mimetype.includes('document')) return '📃';
    return '📁';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
}

function setupModal() {
    // Close modal when clicking the X
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = function() {
            document.getElementById('noteModal').style.display = 'none';
        }
    }
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        if (event.target.id === 'noteModal') {
            event.target.style.display = 'none';
        }
    }
    
    // Search on Enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchNotes();
            }
        });
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
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
    if (container) {
        container.insertBefore(messageDiv, container.firstChild);
        
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
    }
}
