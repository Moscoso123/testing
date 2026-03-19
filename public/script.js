// API Configuration
const API_URL = 'http://localhost:3000/attendance';

// Global variables
let userIp = '';
let editingId = null;

// DOM Elements
document.addEventListener('DOMContentLoaded', function() {
    // Get user IP on page load
    getUserIp();
    
    // Load attendance records
    loadAttendance();

    // Form submission
    document.getElementById('attendanceForm').addEventListener('submit', function(e) {
        e.preventDefault();
        markAttendance();
    });

    // Edit form submission
    document.getElementById('editForm').addEventListener('submit', function(e) {
        e.preventDefault();
        updateRecord();
    });

    // Cancel edit button
    document.getElementById('cancelEdit').addEventListener('click', function() {
        hideEditForm();
    });
});

// Get user's IP address
function getUserIp() {
    const ipDisplay = document.getElementById('userIp');
    
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            userIp = data.ip;
            ipDisplay.textContent = userIp;
        })
        .catch(error => {
            console.error('Error getting IP:', error);
            ipDisplay.textContent = 'Unknown';
            userIp = 'Unknown';
        });
}

// Load all attendance records
function loadAttendance() {
    const table = document.getElementById('attendanceTable');
    const tbody = document.getElementById('attendanceBody');
    const noRecords = document.getElementById('noRecords');
    const spinner = document.getElementById('loadingSpinner');

    // Show spinner, hide table and no records message
    spinner.style.display = 'block';
    table.style.display = 'none';
    noRecords.style.display = 'none';

    fetch(API_URL)
        .then(response => response.json())
        .then(data => {
            spinner.style.display = 'none';
            
            if (data.length === 0) {
                noRecords.style.display = 'block';
                table.style.display = 'none';
            } else {
                table.style.display = 'table';
                noRecords.style.display = 'none';
                renderAttendanceTable(data, tbody);
            }
        })
        .catch(error => {
            console.error('Error loading attendance:', error);
            spinner.style.display = 'none';
            showAlert('Error loading attendance records', 'error');
        });
}

// Render attendance table
function renderAttendanceTable(records, tbody) {
    tbody.innerHTML = '';

    records.forEach(record => {
        const row = document.createElement('tr');
        
        // Format date
        const date = new Date(record.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        row.innerHTML = `
            <td>${record.id}</td>
            <td>${escapeHtml(record.name)}</td>
            <td>Section ${escapeHtml(record.section)}</td>
            <td>${date}</td>
            <td>${record.time}</td>
            <td>${record.ip_address}</td>
            <td class="action-buttons">
                ${canModifyRecord(record.ip_address) ? 
                    `<button class="btn btn-sm btn-warning" onclick="editRecord(${record.id}, '${escapeHtml(record.name)}', '${record.section}')">Edit</button>
                     <button class="btn btn-sm btn-danger" onclick="deleteRecord(${record.id})">Delete</button>` : 
                    '<span class="read-only-badge">Read Only</span>'
                }
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Check if user can modify record
function canModifyRecord(recordIp) {
    return userIp === recordIp;
}

// Mark attendance
function markAttendance() {
    const name = document.getElementById('nameInput').value.trim();
    const section = document.getElementById('sectionInput').value;

    if (!name || !section) {
        showAlert('Please fill in all fields', 'error');
        return;
    }

    fetch(`${API_URL}/mark`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            section: section,
            ip: userIp
        })
    })
    .then(response => response.json())
    .then(data => {
        showAlert(data.message, 'success');
        document.getElementById('attendanceForm').reset();
        loadAttendance();
    })
    .catch(error => {
        console.error('Error marking attendance:', error);
        showAlert('Error marking attendance', 'error');
    });
}

// Edit record
function editRecord(id, name, section) {
    editingId = id;
    document.getElementById('editId').value = id;
    document.getElementById('editName').value = name;
    document.getElementById('editSection').value = section;
    
    document.getElementById('editFormContainer').style.display = 'block';
    
    // Scroll to edit form
    document.getElementById('editFormContainer').scrollIntoView({ 
        behavior: 'smooth' 
    });
}

// Update record
function updateRecord() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();
    const section = document.getElementById('editSection').value;

    if (!name || !section) {
        showAlert('Please fill in all fields', 'error');
        return;
    }

    fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: name,
            section: section,
            ip: userIp
        })
    })
    .then(response => response.json())
    .then(data => {
        showAlert(data.message, 'success');
        hideEditForm();
        loadAttendance();
    })
    .catch(error => {
        console.error('Error updating record:', error);
        showAlert('Error updating record', 'error');
    });
}

// Delete record
function deleteRecord(id) {
    if (!confirm('Are you sure you want to delete this record?')) {
        return;
    }

    fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            ip: userIp
        })
    })
    .then(response => response.json())
    .then(data => {
        showAlert(data.message, 'success');
        loadAttendance();
    })
    .catch(error => {
        console.error('Error deleting record:', error);
        showAlert('Error deleting record', 'error');
    });
}

// Hide edit form
function hideEditForm() {
    document.getElementById('editFormContainer').style.display = 'none';
    document.getElementById('editForm').reset();
    editingId = null;
}

// Show alert message
function showAlert(message, type) {
    // Remove existing alert
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) {
        existingAlert.remove();
    }

    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    // Insert at top of container
    const container = document.querySelector('.container');
    container.insertBefore(alert, container.firstChild);

    // Remove after 3 seconds
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}