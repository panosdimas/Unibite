document.addEventListener('DOMContentLoaded', () => {
    // 1. Auth & Στοιχεία
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userData);
    fetch('/api/check-penalties', { method: 'POST' }).catch(err => console.error(err));
    // --- ΠΡΟΣΘΗΚΗ: Δυναμικό Κουμπί Admin ---
    if (user.role === 'admin') {
        const navLinks = document.querySelector('.nav-links');
        if (navLinks) {
            const adminBtn = document.createElement('a');
            adminBtn.href = 'admin.html';
            adminBtn.textContent = 'Admin Panel';
            adminBtn.style.color = '#ffc107'; 
            adminBtn.style.display = 'block'; 
            adminBtn.style.marginTop = '8px';
            adminBtn.style.marginLeft = '0';       
            navLinks.appendChild(adminBtn);
        }
    }
    document.getElementById('user-info').textContent = `Γεια σου, ${user.username} (Πόντοι: ${user.points})`;
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    const feedList = document.getElementById('feed-list');

    // --- ΑΡΧΙΚΟΠΟΙΗΣΗ ΧΑΡΤΗ FEED ---
    const map = L.map('feed-map').setView([38.246242, 21.735084], 13); // Κέντρο Πάτρα
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Φτιάχνουμε ένα γκρουπ για τις πινέζες για να μπορούμε να τις καθαρίζουμε εύκολα
    const markersGroup = L.layerGroup().addTo(map);

    // 2. Φόρτωση του Feed
    async function loadFeed() {
        try {
            const response = await fetch('/api/feed');
            const ads = await response.json();
            
            feedList.innerHTML = '';
            markersGroup.clearLayers(); // Καθαρίζει τις παλιές πινέζες από τον χάρτη

            if (ads.length === 0) {
                feedList.innerHTML = '<p>Δεν υπάρχει διαθέσιμο φαγητό αυτή τη στιγμή.</p>';
                return;
            }

            ads.forEach(ad => {
                const isSoldOut = ad.available_portions === 0;
                const isMine = ad.cook_id === user.id;

                // --- ΛΟΓΙΚΗ ΓΙΑ ΤΟΝ ΧΑΡΤΗ ---
                // Αν έχει συντεταγμένες και δεν έχει εξαντληθεί, βάζουμε πινέζα!
                if (ad.g_platos && ad.g_mikos && !isSoldOut) {
                    const marker = L.marker([ad.g_platos, ad.g_mikos]);
                    
                    // Τι θα γράφει το συννεφάκι (Popup) όταν το πατάς
                    marker.bindPopup(`
                        <strong style="color: #0056b3; font-size: 1.1em;">${ad.title}</strong><br>
                        <em>από ${ad.cook_name}</em><br>
                        Μερίδες: ${ad.available_portions}<br>
                        <a href="#ad-card-${ad.id}" style="color: green; text-decoration: none; font-weight: bold;">Δες το στη λίστα!</a>
                    `);
                    markersGroup.addLayer(marker);
                }
                // -----------------------------

                // --- ΛΟΓΙΚΗ ΓΙΑ ΤΗ ΛΙΣΤΑ ---
                const card = document.createElement('div');
                card.className = 'ad-card';
                card.id = `ad-card-${ad.id}`; // Το id για να κάνει scroll εκεί αν το πατήσεις από τον χάρτη
                
                if (isSoldOut) card.classList.add('inactive');

                let buttonHTML = '';
                if (isMine) {
                    buttonHTML = `<button class="request-btn" disabled>Δική σου Αγγελία</button>`;
                } else if (isSoldOut) {
                    buttonHTML = `<button class="request-btn" disabled>Εξαντλήθηκε</button>`;
                } else {
                    buttonHTML = `<button class="request-btn ask-btn" data-id="${ad.id}">Θέλω μια μερίδα!</button>`;
                }

                card.innerHTML = `
                    <div style="flex-grow: 1;">
                        <h3 style="margin: 0 0 5px 0; color: ${isSoldOut ? '#6c757d' : '#0056b3'};">${ad.title}</h3>
                        <p style="margin: 5px 0;"><strong>Μάγειρας:</strong> ${ad.cook_name}</p>
                        <p style="margin: 5px 0;"><strong>Μερίδες:</strong> ${ad.available_portions} / ${ad.all_portions}</p>
                        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Παραλαβή:</strong> ${ad.pickup_location} | <strong>Ώρα:</strong> ${ad.pickup_time}</p>
                        <p style="margin: 5px 0; font-size: 0.8em; color: #555;"><strong>Αλλεργιογόνα:</strong> ${ad.allergies || 'Κανένα'}</p>
                        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Σημειώσεις:</strong> ${ad.notes || '-'}</p>
                    </div>
                    <div>
                        ${buttonHTML}
                    </div>
                `;
                
                feedList.appendChild(card);
            });

            // Ενεργοποίηση των κουμπιών αιτήματος
            const requestButtons = document.querySelectorAll('.ask-btn');
            requestButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const adId = e.target.getAttribute('data-id');
                    
                    if (!confirm('Θέλετε να δεσμεύσετε μια μερίδα; Θα χρησιμοποιηθεί 1 πόντος σας.')) return;

                    try {
                        const reqResponse = await fetch('/api/requests', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ ad_id: adId, consumer_id: user.id })
                        });

                        const reqResult = await reqResponse.json();

                        if (reqResponse.ok) {
                            alert(reqResult.message); 
                            loadFeed(); // Ανανεώνουμε για να ενημερωθούν τα νούμερα
                        } else {
                            alert('Σφάλμα: ' + reqResult.message);
                        }
                    } catch (err) {
                        console.error('Σφάλμα δικτύου:', err);
                        alert('Προέκυψε σφάλμα δικτύου.');
                    }
                });
            });

        } catch (error) {
            console.error('Σφάλμα φόρτωσης:', error);
            feedList.innerHTML = '<p style="color: red;">Σφάλμα κατά τη φόρτωση του feed.</p>';
        }
    }

    loadFeed();
});