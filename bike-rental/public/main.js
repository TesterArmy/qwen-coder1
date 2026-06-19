// DOM Elements
const bikesContainer = document.getElementById('bikes-container');
const bookingModal = document.getElementById('booking-modal');
const successModal = document.getElementById('success-modal');
const closeBtn = document.querySelector('.close');
const bookingForm = document.getElementById('booking-form');
const filterButtons = document.querySelectorAll('.filter-btn');

// State
let allBikes = [];
let selectedBike = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadBikes();
    setupEventListeners();
    setMinDate();
});

// Load Bikes from API
async function loadBikes() {
    try {
        const response = await fetch('/api/bikes');
        allBikes = await response.json();
        displayBikes(allBikes);
    } catch (error) {
        console.error('Error loading bikes:', error);
        showError('Failed to load bikes. Please try again.');
    }
}

// Display Bikes
function displayBikes(bikes) {
    bikesContainer.innerHTML = '';
    
    if (bikes.length === 0) {
        bikesContainer.innerHTML = '<p class="no-bikes">No bikes available at the moment.</p>';
        return;
    }

    bikes.forEach(bike => {
        const bikeCard = document.createElement('div');
        bikeCard.className = 'bike-card';
        bikeCard.innerHTML = `
            <img src="${bike.image}" alt="${bike.name}" onerror="this.src='https://via.placeholder.com/400x200?text=Bike+Image'">
            <div class="bike-info">
                <h3>${bike.name}</h3>
                <p class="bike-type">${bike.type}</p>
                <p class="bike-price">$${bike.pricePerHour.toFixed(2)} <span>/ hour</span></p>
                <span class="availability ${bike.available ? 'available' : 'unavailable'}">
                    ${bike.available ? '✓ Available' : '✗ Unavailable'}
                </span>
                <button class="btn-primary btn-full" 
                        onclick="openBookingModal(${bike.id})" 
                        ${!bike.available ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''}>
                    ${bike.available ? 'Book Now' : 'Currently Rented'}
                </button>
            </div>
        `;
        bikesContainer.appendChild(bikeCard);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Close modal
    closeBtn.addEventListener('click', () => {
        bookingModal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === bookingModal) {
            bookingModal.style.display = 'none';
        }
        if (e.target === successModal) {
            successModal.style.display = 'none';
        }
    });

    // Filter buttons
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const filter = btn.dataset.filter;
            if (filter === 'all') {
                displayBikes(allBikes);
            } else {
                const filtered = allBikes.filter(bike => bike.type === filter);
                displayBikes(filtered);
            }
        });
    });

    // Form submission
    bookingForm.addEventListener('submit', handleBooking);

    // Date change listeners for price calculation
    document.getElementById('start-date').addEventListener('change', calculatePrice);
    document.getElementById('end-date').addEventListener('change', calculatePrice);
}

// Set minimum date to current time
function setMinDate() {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('start-date').min = now.toISOString().slice(0, 16);
    
    // Set end date min to start date
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    startDateInput.addEventListener('change', () => {
        endDateInput.min = startDateInput.value;
        calculatePrice();
    });
}

// Open Booking Modal
window.openBookingModal = function(bikeId) {
    selectedBike = allBikes.find(b => b.id === bikeId);
    
    if (!selectedBike || !selectedBike.available) {
        showError('This bike is currently unavailable.');
        return;
    }

    document.getElementById('bike-id').value = selectedBike.id;
    document.getElementById('selected-bike-info').innerHTML = `
        <div style="background: #f8f9fa; padding: 1rem; border-radius: 5px; margin-bottom: 1.5rem;">
            <h3 style="color: #2c3e50;">${selectedBike.name}</h3>
            <p style="color: #7f8c8d;">${selectedBike.type} Bike</p>
            <p style="color: #27ae60; font-weight: bold; font-size: 1.2rem;">$${selectedBike.pricePerHour.toFixed(2)} per hour</p>
        </div>
    `;

    // Reset form
    bookingForm.reset();
    document.getElementById('duration-display').textContent = '-';
    document.getElementById('rate-display').textContent = `$${selectedBike.pricePerHour.toFixed(2)}`;
    document.getElementById('total-display').textContent = '$0.00';
    
    // Set minimum dates
    setMinDate();

    bookingModal.style.display = 'block';
};

// Calculate Price
function calculatePrice() {
    if (!selectedBike) return;

    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;

    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
        showError('End date must be after start date');
        return;
    }

    const totalHours = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60)));
    const totalPrice = totalHours * selectedBike.pricePerHour;

    document.getElementById('duration-display').textContent = `${totalHours} hour(s)`;
    document.getElementById('rate-display').textContent = `$${selectedBike.pricePerHour.toFixed(2)}`;
    document.getElementById('total-display').textContent = `$${totalPrice.toFixed(2)}`;
}

// Handle Booking
async function handleBooking(e) {
    e.preventDefault();

    const bookingData = {
        bikeId: parseInt(document.getElementById('bike-id').value),
        customerName: document.getElementById('customer-name').value,
        customerEmail: document.getElementById('customer-email').value,
        customerPhone: document.getElementById('customer-phone').value,
        startDate: document.getElementById('start-date').value,
        endDate: document.getElementById('end-date').value
    };

    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookingData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Booking failed');
        }

        const result = await response.json();
        
        // Show success modal
        document.getElementById('booking-details').innerHTML = `
            <p><strong>Booking ID:</strong> #${result.id}</p>
            <p><strong>Bike:</strong> ${selectedBike.name}</p>
            <p><strong>Customer:</strong> ${result.customerName}</p>
            <p><strong>Duration:</strong> ${result.totalHours} hours</p>
            <p><strong>Total Paid:</strong> $${result.totalPrice.toFixed(2)}</p>
            <p><strong>Pickup:</strong> ${new Date(result.startDate).toLocaleString()}</p>
            <p><strong>Return:</strong> ${new Date(result.endDate).toLocaleString()}</p>
        `;

        bookingModal.style.display = 'none';
        successModal.style.display = 'block';

        // Reload bikes to update availability
        loadBikes();

    } catch (error) {
        console.error('Booking error:', error);
        showError(error.message);
    }
}

// Close Success Modal
window.closeSuccessModal = function() {
    successModal.style.display = 'none';
};

// Show Error
function showError(message) {
    alert(message);
}

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});
