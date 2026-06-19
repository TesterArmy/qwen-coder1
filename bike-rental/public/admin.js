// Admin Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    document.getElementById('status-filter').addEventListener('change', loadBookings);
}

// Load Dashboard Data
async function loadDashboard() {
    await Promise.all([loadBookings(), loadBikes(), loadStats()]);
}

// Load Bookings
async function loadBookings() {
    try {
        const response = await fetch('/api/bookings');
        const bookings = await response.json();
        
        const statusFilter = document.getElementById('status-filter').value;
        let filteredBookings = bookings;
        
        if (statusFilter !== 'all') {
            filteredBookings = bookings.filter(b => b.status === statusFilter);
        }
        
        displayBookings(filteredBookings);
    } catch (error) {
        console.error('Error loading bookings:', error);
    }
}

// Display Bookings
function displayBookings(bookings) {
    const tbody = document.getElementById('bookings-tbody');
    
    if (bookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;">No bookings found</td></tr>';
        return;
    }
    
    tbody.innerHTML = bookings.map(booking => `
        <tr>
            <td>#${booking.id}</td>
            <td>${booking.bikeName}</td>
            <td>${booking.customerName}</td>
            <td>${booking.customerEmail}</td>
            <td>${formatDate(booking.startDate)}</td>
            <td>${formatDate(booking.endDate)}</td>
            <td>${booking.totalHours}</td>
            <td>$${booking.totalPrice.toFixed(2)}</td>
            <td><span class="status-badge status-${booking.status}">${capitalizeFirst(booking.status)}</span></td>
            <td>
                ${booking.status === 'confirmed' ? `
                    <button class="action-btn btn-complete" onclick="completeBooking(${booking.id})">Complete</button>
                    <button class="action-btn btn-cancel" onclick="cancelBooking(${booking.id})">Cancel</button>
                ` : '-'}
            </td>
        </tr>
    `).join('');
}

// Load Bikes
async function loadBikes() {
    try {
        const response = await fetch('/api/bikes');
        const bikes = await response.json();
        displayBikes(bikes);
    } catch (error) {
        console.error('Error loading bikes:', error);
    }
}

// Display Bikes
function displayBikes(bikes) {
    const tbody = document.getElementById('bikes-tbody');
    
    tbody.innerHTML = bikes.map(bike => `
        <tr>
            <td>#${bike.id}</td>
            <td>${bike.name}</td>
            <td>${bike.type}</td>
            <td>$${bike.pricePerHour.toFixed(2)}</td>
            <td><span class="status-badge ${bike.available ? 'status-confirmed' : 'status-cancelled'}">
                ${bike.available ? 'Available' : 'Rented'}
            </span></td>
        </tr>
    `).join('');
}

// Load Stats
async function loadStats() {
    try {
        const response = await fetch('/api/bookings');
        const bookings = await response.json();
        
        const totalBookings = bookings.length;
        const activeBookings = bookings.filter(b => b.status === 'confirmed').length;
        const totalRevenue = bookings
            .filter(b => b.status !== 'cancelled')
            .reduce((sum, b) => sum + b.totalPrice, 0);
        
        const bikesResponse = await fetch('/api/bikes');
        const bikes = await bikesResponse.json();
        const availableBikes = bikes.filter(b => b.available).length;
        
        document.getElementById('total-bookings').textContent = totalBookings;
        document.getElementById('active-bookings').textContent = activeBookings;
        document.getElementById('total-revenue').textContent = `$${totalRevenue.toFixed(2)}`;
        document.getElementById('available-bikes').textContent = availableBikes;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Complete Booking
window.completeBooking = async function(bookingId) {
    if (!confirm('Mark this booking as completed?')) return;
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}/complete`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            throw new Error('Failed to complete booking');
        }
        
        alert('Booking completed successfully!');
        loadDashboard();
    } catch (error) {
        console.error('Error completing booking:', error);
        alert('Failed to complete booking. Please try again.');
    }
};

// Cancel Booking
window.cancelBooking = async function(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
        const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            throw new Error('Failed to cancel booking');
        }
        
        alert('Booking cancelled successfully!');
        loadDashboard();
    } catch (error) {
        console.error('Error cancelling booking:', error);
        alert('Failed to cancel booking. Please try again.');
    }
};

// Helper Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function capitalizeFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Auto-refresh every 30 seconds
setInterval(loadDashboard, 30000);
