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
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showLoginLink = document.getElementById('show-login');
    const loginCard = document.getElementById('login-card');
    const signupCard = document.getElementById('signup-card');
    const loginError = document.getElementById('login-error');
    const signupError = document.getElementById('signup-error');

    showSignupLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.style.display = 'none';
        signupCard.style.display = 'block';
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        signupCard.style.display = 'none';
        loginCard.style.display = 'block';
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = e.target.querySelector('#login-email').value;
        const password = e.target.querySelector('#login-password').value;
        try {
            await auth.signInWithEmailAndPassword(email, password);
            window.location.href = 'staff-portal.html';
        } catch (error) {
            loginError.textContent = error.message;
            loginError.style.display = 'block';
        }
    });

    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = e.target.querySelector('#signup-name').value;
        const email = e.target.querySelector('#signup-email').value;
        const password = e.target.querySelector('#signup-password').value;
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await db.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                role: 'staff' 
            });
            window.location.href = 'staff-portal.html';
        } catch (error) {
            signupError.textContent = error.message;
            signupError.style.display = 'block';
        }
    });
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
    const generatedTicketsGrid = document.querySelector('.generated-tickets-grid');
    const downloadBtnContainer = document.getElementById('download-btn-container');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        generatedTicketsGrid.innerHTML = '';
        downloadBtnContainer.style.display = 'none';

        const eventName = document.getElementById('event-name').value;
        const attendeeNames = document.getElementById('attendee-names').value.split(',').map(name => name.trim()).filter(name => name);
        const instagramLink = document.getElementById('instagram-link').value;
        const companyLogoFile = document.getElementById('company-logo').files[0];
        const sponsorTitle = document.getElementById('sponsor-title').value || 'Sponsored By';
        const sponsorLogosFiles = document.getElementById('sponsor-logos').files;

        const companyLogoUrl = companyLogoFile ? URL.createObjectURL(companyLogoFile) : 'https://res.cloudinary.com/dy2hxcyaf/image/upload/v1758305428/Artboard_1bot_logo_2_zwfw2t.png';
        const sponsorLogosUrls = Array.from(sponsorLogosFiles).map(file => URL.createObjectURL(file));

        const ticketsToZip = [];

        // Save each attendee to Firestore and generate the ticket
        for (const name of attendeeNames) {
            await db.collection('attendees').doc(name.toLowerCase().replace(/\s/g, '_')).set({
                name: name,
                checkedIn: false
            });

            const ticketEl = document.getElementById('ticket-template').cloneNode(true);
            ticketEl.removeAttribute('id');
            ticketEl.style.display = 'block';
            
            // Populate ticket with data
            ticketEl.querySelector('.event-name').textContent = eventName.toUpperCase();
            ticketEl.querySelector('.attendee-name').textContent = name.toUpperCase();
            ticketEl.querySelector('.ticket-logo').src = companyLogoUrl;

            // Generate QR Code with attendee's name
            const qrContainer = ticketEl.querySelector('.qr-code-container');
            new QRCode(qrContainer, {
                text: name,
                width: 128,
                height: 128,
                colorDark: '#000000',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
            
            // Add sponsor section
            const sponsorTitleEl = ticketEl.querySelector('.sponsor-title');
            if (sponsorLogosFiles.length > 0) {
                sponsorTitleEl.textContent = sponsorTitle;
                const sponsorLogosContainer = ticketEl.querySelector('.sponsor-logos');
                sponsorLogosUrls.forEach(url => {
                    const img = document.createElement('img');
                    img.src = url;
                    img.className = 'sponsor-logo-img';
                    sponsorLogosContainer.appendChild(img);
                });
            } else {
                sponsorTitleEl.style.display = 'none';
            }

            // Add Instagram link
            const contactInfoEl = ticketEl.querySelector('.contact-info');
            if (instagramLink) {
                contactInfoEl.textContent = `Follow us on Instagram: ${instagramLink}`;
            } else {
                contactInfoEl.textContent = 'For more enquiries call or WhatsApp: 08158768689';
            }

            generatedTicketsGrid.appendChild(ticketEl);
            ticketsToZip.push({ element: ticketEl, name: name });
        }

        if (ticketsToZip.length > 0) {
            downloadBtnContainer.style.display = 'block';
        }

        document.getElementById('download-all-btn').onclick = async () => {
            const zip = new JSZip();
            for (const ticket of ticketsToZip) {
                const dataUrl = await htmlToImage.toPng(ticket.element);
                const fileName = `${eventName.replace(/\s/g, '_')}_${ticket.name.replace(/\s/g, '_')}.png`;
                zip.file(fileName, dataUrl.split('base64,')[1], { base64: true });
            }
            zip.generateAsync({ type: 'blob' }).then(content => saveAs(content, `${eventName.replace(/\s/g, '_')}_tickets.zip`));
        };
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
function showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast toast-${type}`;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}
