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
        <div class="note-card" onclick="viewNote('${note._id}')">
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

function viewNote(noteId) {
    window.location.href = `/note-detail.html?id=${noteId}`;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.reload();
}

function setupModal() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchNotes();
            }
        });
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

// Utility
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString();
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function showMessage(message, type) {
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
