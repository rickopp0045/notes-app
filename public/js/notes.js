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
}

async function loadNotes(searchParams = {}) {
    const token = localStorage.getItem('token');

    try {
        const queryString = new URLSearchParams(searchParams).toString();
        const url = `/api/notes${queryString ? '?' + queryString : ''}`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.status === 401) {
            logout();
            return;
        }

        const notes = await response.json();

        if (response.ok) {
            displayNotes(notes);
        } else {
            alert('Failed to load notes');
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

function displayNotes(notes) {
    const notesGrid = document.getElementById('notesGrid');

    if (notes.length === 0) {
        notesGrid.innerHTML = '<p class="text-center">No notes found.</p>';
        return;
    }

    notesGrid.innerHTML = notes.map(note => `
        <div class="note-card">
            <h3>${note.title}</h3>
            <p><strong>Author:</strong> ${note.authorName}</p>
            <p><strong>Category:</strong> ${note.category || 'N/A'}</p>
            <p>${truncateText(note.content, 100)}</p>
            <button onclick="openNotePage('${note._id}')">View Details</button>
        </div>
    `).join('');
}

function openNotePage(noteId) {
    window.location.href = `/note-details.html?id=${noteId}`;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
}
