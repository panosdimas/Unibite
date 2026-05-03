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
    // ΣΥΝΑΡΤΗΣΗ ΠΟΥ ΑΝΑΝΕΩΝΕΙ ΤΟΥΣ ΠΟΝΤΟΥΣ ΣΤΗΝ ΟΘΟΝΗ ΖΩΝΤΑΝΑ
    function updatePointsUI() {
        fetch(`/api/users/${user.id}`)
            .then(res => res.json())
            .then(data => {
                if (data.points !== undefined) {
                    user.points = data.points;
                    localStorage.setItem('user', JSON.stringify(user)); 
                    document.getElementById('user-info').textContent = `Γεια σου, ${user.username} (Πόντοι: ${user.points})`;
                }
            }).catch(err => console.error('Σφάλμα ανανέωσης πόντων:', err));
    }

    // Καλούμε τη συνάρτηση 1 φορά όταν μπαίνει στη σελίδα
    updatePointsUI();
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

    // --- ΛΟΓΙΚΗ ΦΙΛΤΡΟΥ ΚΑΙ ΑΠΟΣΤΑΣΗΣ ---
    let allAds = []; // Εδώ θα κρατάμε όλες τις αγγελίες της βάσης
    let userLat = null;
    let userLng = null;
    let userMarker = null;
    let isFilterActive = false;

    // Εμφάνιση/Απόκρυψη του Πάνελ
    document.getElementById('toggle-filter-btn').addEventListener('click', () => {
        const panel = document.getElementById('filter-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    });

    // Όταν ο χρήστης κάνει κλικ στον χάρτη (για να βάλει τη θέση του)
    map.on('click', function(e) {
        if (document.getElementById('filter-panel').style.display === 'block') {
            userLat = e.latlng.lat;
            userLng = e.latlng.lng;
            
            if (userMarker) {
                userMarker.setLatLng(e.latlng);
            } else {
                // Φτιάχνουμε μια κόκκινη πινέζα για τον χρήστη
                const redIcon = L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
                });
                userMarker = L.marker(e.latlng, {icon: redIcon}).addTo(map);
                userMarker.bindPopup("<b>Η τοποθεσία σου!</b>").openPopup();
            }
        }
    });

    // Μαθηματικός Τύπος Haversine (Υπολογίζει απόσταση μεταξύ 2 συντεταγμένων σε χλμ)
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Ακτίνα της Γης
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    // Κουμπί "Εφαρμογή"
    document.getElementById('apply-filter-btn').addEventListener('click', () => {
        if (!userLat || !userLng) {
            alert('Παρακαλώ κάνε κλικ στον χάρτη για να επιλέξεις την τοποθεσία σου (κόκκινη πινέζα)!');
            return;
        }

        const maxDist = parseFloat(document.getElementById('filter-distance').value);
        const limit = parseInt(document.getElementById('filter-limit').value, 10);

        // 1. Υπολογισμός απόστασης για κάθε αγγελία
        let filteredAds = allAds.map(ad => {
            ad.distance = (ad.g_platos && ad.g_mikos) ? calculateDistance(userLat, userLng, ad.g_platos, ad.g_mikos) : Infinity;
            return ad;
        });

        // 2. Φιλτράρισμα βάσει χιλιομέτρων (κρατάμε όσα είναι <= maxDist)
        filteredAds = filteredAds.filter(ad => ad.distance <= maxDist);

        // 3. Ταξινόμηση (Πρώτα τα διαθέσιμα βάσει απόστασης, μετά τα εξαντλημένα)
        filteredAds.sort((a, b) => {
            const aSoldOut = a.available_portions === 0 ? 1 : 0;
            const bSoldOut = b.available_portions === 0 ? 1 : 0;
            
            if (aSoldOut !== bSoldOut) {
                return aSoldOut - bSoldOut; // Το εξαντλημένο πάει κάτω
            }
            return a.distance - b.distance; // Αν είναι και τα 2 διαθέσιμα (ή και τα 2 εξαντλημένα), ταξινόμησε βάσει απόστασης
        });

        // 4. Περιορισμός αποτελεσμάτων (LIMIT)
        if (filteredAds.length > limit) filteredAds = filteredAds.slice(0, limit);

        isFilterActive = true;
        renderAds(filteredAds); // Ζωγραφίζουμε τα φιλτραρισμένα
    });

    // Κουμπί "Καθαρισμός"
    document.getElementById('clear-filter-btn').addEventListener('click', () => {
        isFilterActive = false;
        if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
        userLat = null; userLng = null;
        renderAds(allAds); // Ζωγραφίζουμε ξανά όλες τις αγγελίες
    });


    // --- ΦΟΡΤΩΣΗ ΚΑΙ ΖΩΓΡΑΦΙΚΗ ΤΩΝ ΑΓΓΕΛΙΩΝ ---
    
    // Τραβάει τις αγγελίες από τον Server
    async function loadFeed() {
        try {
            const response = await fetch('/api/feed');
            let fetchedAds = await response.json();
            
            // --- ΠΡΟΣΘΗΚΗ: Σπρώχνουμε τα "Εξαντλημένα" στο τέλος ---
            fetchedAds.sort((a, b) => {
                const aSoldOut = a.available_portions === 0 ? 1 : 0;
                const bSoldOut = b.available_portions === 0 ? 1 : 0;
                return aSoldOut - bSoldOut; 
            });
            // --------------------------------------------------------
            
            allAds = fetchedAds; // Αποθηκεύουμε τα ταξινομημένα δεδομένα
            
            // Αν το φίλτρο είναι ήδη ανοιχτό, το ξανατρέχουμε για να ανανεωθούν τα δεδομένα
            if (isFilterActive) {
                document.getElementById('apply-filter-btn').click();
            } else {
                renderAds(allAds);
            }
        } catch (error) {
            feedList.innerHTML = '<p style="color: red;">Σφάλμα κατά τη φόρτωση του feed.</p>';
        }
    }

    // Ζωγραφίζει τις κάρτες και τις πινέζες στην οθόνη
    function renderAds(adsToRender) {
        feedList.innerHTML = '';
        markersGroup.clearLayers();

        if (adsToRender.length === 0) {
            feedList.innerHTML = '<p>Δεν βρέθηκαν αποτελέσματα με αυτά τα κριτήρια.</p>';
            return;
        }

        adsToRender.forEach(ad => {
            const isSoldOut = ad.available_portions === 0;
            const isMine = ad.cook_id === user.id;

            // ΧΑΡΤΗΣ: Προσθήκη πινέζας
            if (ad.g_platos && ad.g_mikos && !isSoldOut) {
                const marker = L.marker([ad.g_platos, ad.g_mikos]);
                marker.bindPopup(`
                    <strong style="color: #0056b3;">${ad.title}</strong><br>
                    Μερίδες: ${ad.available_portions}<br>
                    <a href="#ad-card-${ad.id}" style="color: green; font-weight: bold;">Δες το στη λίστα!</a>
                `);
                markersGroup.addLayer(marker);
            }

            // Εμφάνιση της Απόστασης στον τίτλο (Αν το φίλτρο είναι ενεργό)
            let distanceHtml = '';
            if (isFilterActive && ad.distance !== Infinity) {
                distanceHtml = `<span style="color: #d63384; font-size: 0.8em; margin-left: 10px;">(Απέχει ${ad.distance.toFixed(1)} χλμ)</span>`;
            }

            // ΛΙΣΤΑ: Δημιουργία Κάρτας
            const card = document.createElement('div');
            card.className = 'ad-card';
            card.id = `ad-card-${ad.id}`;
            card.style.display = 'block'; // ΠΡΟΣΘΗΚΗ: Ακυρώνει την οριζόντια διάταξη της κάρτας!
            if (isSoldOut) card.classList.add('inactive');

            let buttonHTML = isMine ? `<button class="request-btn" disabled>Δική σου</button>` :
                             isSoldOut ? `<button class="request-btn" disabled>Εξαντλήθηκε</button>` :
                             `<button class="request-btn ask-btn" data-id="${ad.id}">Θέλω μια μερίδα!</button>`;

            // Εικόνα που απλώνεται σε όλο το πλάτος (αν υπάρχει)
            let imageHTML = ad.image 
                ? `<img src="${ad.image}" alt="Φωτογραφία φαγητού" style="width: 100%; height: 220px; object-fit: cover; border-radius: 8px; margin-bottom: 15px; display: block;">` 
                : '';

            // Νέα Δομή: Η εικόνα πάνω, και από κάτω κείμενο και κουμπί δίπλα-δίπλα
            card.innerHTML = `
                ${imageHTML}
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex-grow: 1; padding-right: 15px;">
                        <h3 style="margin: 0 0 5px 0; color: ${isSoldOut ? '#6c757d' : '#0056b3'};">${ad.title} ${distanceHtml}</h3>
                        <p style="margin: 5px 0;"><strong>Μάγειρας:</strong> ${ad.cook_name} | <strong>Μερίδες:</strong> ${ad.available_portions}/${ad.all_portions}</p>
                        <p style="margin: 5px 0; font-size: 0.9em;"><strong>Παραλαβή:</strong> ${ad.pickup_location} | <strong>Ώρα:</strong> ${ad.pickup_time}</p>
                    </div>
                    <div>${buttonHTML}</div>
                </div>
            `;
            feedList.appendChild(card);
        });

        // Σύνδεση των νέων κουμπιών "Θέλω μια μερίδα"
        document.querySelectorAll('.ask-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const adId = e.target.getAttribute('data-id');
                if (!confirm('Θέλετε να δεσμεύσετε μια μερίδα; (Κοστίζει 1 πόντο)')) return;

                try {
                    const reqResponse = await fetch('/api/requests', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ad_id: adId, consumer_id: user.id })
                    });
                    const reqResult = await reqResponse.json();

                    if (reqResponse.ok) {
                        alert(reqResult.message);
                        loadFeed();
                        updatePointsUI();
                    } else {
                        alert('Σφάλμα: ' + reqResult.message);
                    }
                } catch (err) { console.error(err); }
            });
        });
    }

    // Φόρτωση με το άνοιγμα της σελίδας
    loadFeed();
});