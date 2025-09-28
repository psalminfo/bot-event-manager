// script.js

document.addEventListener('DOMContentLoaded', () => {
    // Determine the current page to apply correct logic
    const currentPage = window.location.pathname.split('/').pop();

    if (currentPage === 'auth.html') {
        setupAuthForms();
    } else if (currentPage === 'staff-portal.html') {
        auth.onAuthStateChanged(user => {
            if (user) {
                initializeStaffPortal(user);
            } else {
                window.location.href = 'auth.html';
            }
        });
    } else if (currentPage === 'admin.html') {
        initializeAdminPortal();
    }
});

// --- Auth Functions (Auth.html) ---
function setupAuthForms() {
    // ... (Your existing login/signup form logic)
    // IMPORTANT: Sign-up still creates a user with 'staff' role
}

// --- Staff Portal Functions (staff-portal.html) ---
function initializeStaffPortal(user) {
    const staffCheckinCount = document.getElementById('staff-checkin-count');
    const qrReader = document.getElementById('qr-reader');
    
    // Live counter for staff
    db.collection('attendees').where('checkedInBy', '==', user.uid).onSnapshot(snapshot => {
        staffCheckinCount.textContent = snapshot.size;
    });

    // Scanner logic
    const html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
    html5QrcodeScanner.render(
        (decodedText, decodedResult) => {
            checkInAttendee(decodedText, user.uid);
            html5QrcodeScanner.clear(); // Stop scanning after a successful read
        },
        errorMessage => { /* Do nothing for errors */ }
    );
    
    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
        auth.signOut().then(() => window.location.href = 'auth.html');
    });
}

// --- Admin Portal Functions (admin.html) ---
function initializeAdminPortal() {
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('page-title');
    const titles = { dashboard: "Dashboard", generator: "Ticket Generator", scanner: "QR Scanner" };

    function showPage(hash) {
        pages.forEach(page => page.style.display = 'none');
        navLinks.forEach(link => link.classList.remove('active'));
        const activePage = document.querySelector(hash);
        if (activePage) {
            activePage.style.display = 'block';
            document.querySelector(`a[href="${hash}"]`).classList.add('active');
            pageTitle.textContent = titles[hash.substring(1)];
        }
    }
    navLinks.forEach(link => link.addEventListener('click', e => { e.preventDefault(); showPage(e.currentTarget.hash); }));
    showPage(window.location.hash || '#dashboard');

    // Live counter for all check-ins
    db.collection('attendees').onSnapshot(snapshot => {
        document.getElementById('total-checkin-count').textContent = snapshot.size;
        updateAttendeeTable(snapshot.docs);
    });

    // Ticket Generator logic
    const form = document.getElementById('ticket-generator-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const eventName = document.getElementById('event-name').value;
        const attendeeNames = document.getElementById('attendee-names').value.split(',').map(name => name.trim());
        generateTickets(eventName, attendeeNames);
    });

    // Admin Scanner Logic
    const qrReaderAdmin = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: 250 });
    qrReaderAdmin.render(
        (decodedText, decodedResult) => {
            checkInAttendee(decodedText, 'admin');
            qrReaderAdmin.clear();
        },
        errorMessage => { /* Do nothing for errors */ }
    );
}

// --- Common Functions for both Portals ---
async function checkInAttendee(attendeeName, scannerId) {
    const attendeeRef = db.collection('attendees').doc(attendeeName.toLowerCase().replace(/\s/g, '_'));
    const doc = await attendeeRef.get();

    if (doc.exists) {
        if (doc.data().checkedIn) {
            showToast(`Error: ${attendeeName} is already checked in.`, 'error');
        } else {
            await attendeeRef.update({
                checkedIn: true,
                checkedInTime: new Date(),
                checkedInBy: scannerId
            });
            showToast(`Success: ${attendeeName} has been checked in!`, 'success');
        }
    } else {
        showToast(`Error: Attendee ${attendeeName} not found.`, 'error');
    }
}

async function generateTickets(eventName, attendeeNames) {
    const ticketsToZip = [];
    const generatedTicketsGrid = document.querySelector('.generated-tickets-grid');
    generatedTicketsGrid.innerHTML = '';
    const downloadBtnContainer = document.getElementById('download-btn-container');
    
    // Create new documents for each attendee and generate tickets
    for (const name of attendeeNames) {
        await db.collection('attendees').doc(name.toLowerCase().replace(/\s/g, '_')).set({
            name: name,
            checkedIn: false
        });

        const ticketEl = document.getElementById('ticket-template').cloneNode(true);
        ticketEl.removeAttribute('id');
        ticketEl.style.display = 'block';
        ticketEl.querySelector('.event-name').textContent = eventName.toUpperCase();
        ticketEl.querySelector('.attendee-name').textContent = name.toUpperCase();

        const qrContainer = ticketEl.querySelector('.qr-code-container');
        new QRCode(qrContainer, { text: name, width: 128, height: 128, correctLevel: QRCode.CorrectLevel.H });

        generatedTicketsGrid.appendChild(ticketEl);
        ticketsToZip.push({ element: ticketEl, name: name });
    }
    
    downloadBtnContainer.style.display = 'block';
    document.getElementById('download-all-btn').onclick = async () => {
        const zip = new JSZip();
        for (const ticket of ticketsToZip) {
            const dataUrl = await htmlToImage.toPng(ticket.element);
            const fileName = `${eventName.replace(/\s/g, '_')}_${ticket.name.replace(/\s/g, '_')}.png`;
            zip.file(fileName, dataUrl.split('base64,')[1], { base64: true });
        }
        zip.generateAsync({ type: 'blob' }).then(content => saveAs(content, `${eventName.replace(/\s/g, '_')}_tickets.zip`));
    };
}

function updateAttendeeTable(docs) {
    const tableBody = document.querySelector('#attendee-table tbody');
    tableBody.innerHTML = '';
    docs.forEach(doc => {
        const data = doc.data();
        const row = tableBody.insertRow();
        row.innerHTML = `
            <td>${data.name}</td>
            <td><span class="badge badge-${data.checkedIn ? 'success' : 'secondary'}">${data.checkedIn ? 'Checked In' : 'Pending'}</span></td>
            <td>${data.checkedInTime ? new Date(data.checkedInTime.toDate()).toLocaleString() : 'N/A'}</td>
            <td>${data.checkedInBy || 'N/A'}</td>
        `;
    });
}
