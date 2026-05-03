document.addEventListener('DOMContentLoaded', () => {
    // 1. Έλεγχος Auth & Στοιχεία Χρήστη
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
// --- ΖΩΝΤΑΝΗ ΑΝΑΝΕΩΣΗ ΠΟΝΤΩΝ ---
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
    updatePointsUI(); // Το καλούμε με το που ανοίγει η σελίδα!
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    const createAdForm = document.getElementById('create-ad-form');
    const adMessage = document.getElementById('ad-message');
    const adsList = document.getElementById('my-ads-list');
    const requestsList = document.getElementById('requests-list');
    let editingAdId = null;
    let currentEditImage = null; 

    // --- LEAFLET MAP SETUP ---
    let selectedLat = null;
    let selectedLng = null;
    let marker = null;

    // Αρχικοποίηση Χάρτη με κέντρο την Πάτρα (Συντεταγμένες: 38.246242, 21.735084)
    const map = L.map('map').setView([38.246242, 21.735084], 13); 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Τι γίνεται όταν ο χρήστης κάνει κλικ στον χάρτη
    map.on('click', function(e) {
        selectedLat = e.latlng.lat;
        selectedLng = e.latlng.lng;
        
        if (marker) {
            marker.setLatLng(e.latlng); // Μετακινεί την υπάρχουσα πινέζα
        } else {
            marker = L.marker(e.latlng).addTo(map); // Φτιάχνει νέα πινέζα
        }
    });

    // Βοηθητική συνάρτηση για μετατροπή εικόνας σε Base64
    function getBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    // 2. Υποβολή Φόρμας (Δημιουργία Ή Επεξεργασία)
    createAdForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Έλεγχος αν έβαλε πινέζα!
        if (!selectedLat || !selectedLng) {
            alert('Παρακαλώ κάντε κλικ στον χάρτη για να επιλέξετε το ακριβές σημείο!');
            return;
        }

        // --- ΝΕΟ: Διαβάζουμε το αρχείο της εικόνας ---
        const imageFile = document.getElementById('image').files[0];
        let finalImageBase64 = currentEditImage; // Κρατάμε την παλιά εικόνα αν πρόκειται για edit

        if (imageFile) {
            finalImageBase64 = await getBase64(imageFile); // Μετατροπή της νέας εικόνας
        }

        const adData = {
            cook_id: user.id,
            title: document.getElementById('title').value,
            all_portions: document.getElementById('portions').value,
            pickup_location: document.getElementById('location').value,
            pickup_time: document.getElementById('time').value,
            allergies: document.getElementById('allergies').value,
            notes: document.getElementById('notes').value,
            g_platos: selectedLat,
            g_mikos: selectedLng,
            image: finalImageBase64 // Στέλνουμε το Base64 string στον server!
        };

        const method = editingAdId ? 'PUT' : 'POST';
        const endpoint = editingAdId ? `/api/ads/${editingAdId}` : '/api/ads';

        try {
            const response = await fetch(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(adData)
            });

            const result = await response.json();

            if (response.ok) {
                adMessage.textContent = result.message;
                adMessage.style.color = 'green';
                createAdForm.reset();
                editingAdId = null; 
                currentEditImage = null; // Καθαρίζουμε την εικόνα
                document.querySelector('#create-ad-form button[type="submit"]').textContent = 'Δημιουργία Αγγελίας';
                
                if (marker) { map.removeLayer(marker); marker = null; }
                selectedLat = null; selectedLng = null;
                map.setView([38.246242, 21.735084], 13); 

                loadMyAds(); 
            } else {
                adMessage.textContent = result.message;
                adMessage.style.color = 'red';
            }
        } catch (error) {
            console.error('Σφάλμα:', error);
        }
    });

    // Συνάρτηση για τα κουμπιά των καρτών
    function attachCardEvents(ads) {
        // Διαγραφή
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async (e) => {
                const adId = e.target.getAttribute('data-id');
                if (!confirm('Είστε σίγουροι ότι θέλετε να διαγράψετε αυτή την αγγελία;')) return;

                try {
                    const delResponse = await fetch(`/api/ads/${adId}`, { method: 'DELETE' });
                    if (delResponse.ok) loadMyAds(); 
                } catch (err) { console.error(err); }
            });
        });

        // Επεξεργασία
        const editButtons = document.querySelectorAll('.edit-btn');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const adId = e.target.getAttribute('data-id');
                const ad = ads.find(a => a.id == adId); 
                
                document.getElementById('title').value = ad.title;
                document.getElementById('portions').value = ad.all_portions;
                document.getElementById('location').value = ad.pickup_location;
                document.getElementById('time').value = ad.pickup_time;
                document.getElementById('allergies').value = ad.allergies || '';
                document.getElementById('notes').value = ad.notes || '';
                
                currentEditImage = ad.image; // <--- ΣΗΜΑΝΤΙΚΟ: Θυμόμαστε την παλιά εικόνα!

                // Ενημέρωση χάρτη με τις παλιές συντεταγμένες
                selectedLat = ad.g_platos;
                selectedLng = ad.g_mikos;
                if (selectedLat && selectedLng) {
                    const latlng = [selectedLat, selectedLng];
                    if (marker) { marker.setLatLng(latlng); } 
                    else { marker = L.marker(latlng).addTo(map); }
                    map.setView(latlng, 15); // Ζουμάρει στο σημείο
                }

                editingAdId = ad.id;
                document.querySelector('#create-ad-form button[type="submit"]').textContent = 'Αποθήκευση Αλλαγών';
                window.scrollTo(0, 0); 
            });
        });
    }

    // 3. Φόρτωση Αγγελιών
    async function loadMyAds() {
        try {
            const response = await fetch(`/api/ads/${user.id}`);
            const ads = await response.json();
            adsList.innerHTML = ''; 

            if (ads.length === 0) {
                adsList.innerHTML = '<p>Δεν έχεις ανεβάσει καμία μερίδα ακόμα.</p>';
                return;
            }

            ads.forEach(ad => {
                const adCard = document.createElement('div');
                adCard.style.border = '1px solid #ccc';
                adCard.style.padding = '15px';
                adCard.style.margin = '10px 0';
                adCard.style.borderRadius = '8px';
                adCard.style.backgroundColor = '#f9f9f9';
                
                adCard.innerHTML = `
                    <h4 style="margin-top: 0; color: #0056b3;">${ad.title}</h4>
                    <p><strong>Διαθέσιμες μερίδες:</strong> ${ad.available_portions} / ${ad.all_portions}</p>
                    <p><strong>Σημείο:</strong> ${ad.pickup_location} | <strong>Ώρα:</strong> ${ad.pickup_time}</p>
                    <button class="edit-btn" data-id="${ad.id}" style="background-color: #ffc107; color: black; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 10px; margin-right: 5px;">Επεξεργασία</button>
                    <button class="delete-btn" data-id="${ad.id}" style="background-color: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Διαγραφή</button>
                `;
                adsList.appendChild(adCard);
            });
            attachCardEvents(ads);
        } catch (error) { console.error('Σφάλμα:', error); }
    }

    // 4. Φόρτωση Αιτημάτων
    async function loadRequests() {
        try {
            const response = await fetch(`/api/cook-requests/${user.id}`);
            const requests = await response.json();
            requestsList.innerHTML = '';

            if (requests.length === 0) {
                requestsList.innerHTML = '<p>Δεν έχεις νέα αιτήματα.</p>';
                return;
            }

            requests.forEach(req => {
                const reqCard = document.createElement('div');
                reqCard.style.border = '1px solid #ccc';
                reqCard.style.padding = '10px';
                reqCard.style.margin = '10px 0';
                reqCard.style.borderRadius = '8px';
                reqCard.style.display = 'flex';
                reqCard.style.justifyContent = 'space-between';
                reqCard.style.alignItems = 'center';

                let statusBadge = '';
                let actionButtons = '';

                if (req.request_status === 'pending') {
                    statusBadge = '<span style="color: orange; font-weight: bold;">Σε εκκρεμότητα</span>';
                    actionButtons = `
                        <button class="approve-btn" data-reqid="${req.request_id}" data-adid="${req.ad_id}" style="background-color: #28a745; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Αποδοχή</button>
                        <button class="reject-btn" data-reqid="${req.request_id}" data-adid="${req.ad_id}" style="background-color: #dc3545; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Απόρριψη</button>
                    `;
                } else if (req.request_status === 'accepted') {
                    statusBadge = '<span style="color: blue; font-weight: bold;">Προς Παράδοση</span>';
                    actionButtons = `
                        <button class="finalize-btn" data-reqid="${req.request_id}" data-consumerid="${req.consumer_id}" data-status="completed" style="background-color: #17a2b8; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer; margin-right: 5px;">Παρελήφθη</button>
                        <button class="finalize-btn" data-reqid="${req.request_id}" data-consumerid="${req.consumer_id}" data-status="not_show" style="background-color: #6c757d; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;">Δεν Εμφανίστηκε</button>
                    `;
                } else if (req.request_status === 'completed') {
                    statusBadge = '<span style="color: green; font-weight: bold;">Ολοκληρώθηκε</span>';
                } else if (req.request_status === 'not_show') {
                    statusBadge = '<span style="color: red; font-weight: bold;">Δεν εμφανίστηκε</span>';
                } else if (req.request_status === 'rejected') {
                    statusBadge = '<span style="color: red; font-weight: bold;">Απορρίφθηκε</span>';
                }

                // --- ΥΠΟΛΟΓΙΣΜΟΣ HTML ΑΞΙΟΛΟΓΗΣΗΣ ---
                let reviewHTML = '';
                if (req.request_status === 'completed' && req.review_rating) {
                    if (req.review_text === 'SYSTEM_PENALTY') {
                         reviewHTML = `<p style="color: gray; font-size: 0.85em; margin: 5px 0 0 0;"><em>Δεν άφησε αξιολόγηση (+1 πόντος)</em></p>`;
                    } else {
                         reviewHTML = `<p style="color: #ffc107; font-size: 0.9em; margin: 5px 0 0 0; background: #333; padding: 2px 5px; border-radius: 4px; display: inline-block;">
                             <strong>${req.review_rating}/5 ⭐</strong> <span style="color: white; font-weight: normal;">"${req.review_text}"</span>
                         </p>`;
                    }
                }
                // -------------------------------------

                reqCard.innerHTML = `
                    <div>
                        <p style="margin: 0;">Ο χρήστης <strong>${req.consumer_name}</strong> ζήτησε μερίδα από: <em>${req.ad_title}</em></p>
                        <p style="margin: 5px 0 0 0; font-size: 0.9em;">Κατάσταση: ${statusBadge}</p>
                        ${reviewHTML} <!-- ΕΔΩ ΕΜΦΑΝΙΖΕΤΑΙ Η ΑΞΙΟΛΟΓΗΣΗ -->
                    </div>
                    <div>${actionButtons}</div>
                `;
                requestsList.appendChild(reqCard);
            });
            attachRequestEvents();
        } catch (error) { console.error(error); }
    }



    function attachRequestEvents() {
        const approveBtns = document.querySelectorAll('.approve-btn');
        const rejectBtns = document.querySelectorAll('.reject-btn');
        const finalizeBtns = document.querySelectorAll('.finalize-btn'); 

        approveBtns.forEach(btn => btn.addEventListener('click', () => updateRequestStatus(btn, 'accepted')));
        rejectBtns.forEach(btn => btn.addEventListener('click', () => updateRequestStatus(btn, 'rejected')));
        finalizeBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const reqId = e.target.getAttribute('data-reqid');
                const consumerId = e.target.getAttribute('data-consumerid');
                const newStatus = e.target.getAttribute('data-status');
                
                if (!confirm('Είστε σίγουροι για αυτή την ενέργεια;')) return;
                try {
                    const response = await fetch(`/api/requests/${reqId}/finalize`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: newStatus, consumer_id: consumerId })
                    });
                    if (response.ok) {
                        loadRequests();  // Ανανεώνει τη λίστα αιτημάτων
                        loadMyAds();     // ΠΡΟΣΘΗΚΗ: Ανανεώνει ΚΑΙ τη λίστα των αγγελιών!
                    }
                } catch (error) { console.error(error); }
            });
        });
    }

    async function updateRequestStatus(btn, newStatus) {
        const reqId = btn.getAttribute('data-reqid');
        const adId = btn.getAttribute('data-adid');
        try {
            const response = await fetch(`/api/requests/${reqId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus, ad_id: adId })
            });
            if (response.ok) { loadRequests(); loadMyAds(); }
        } catch (error) { console.error(error); }
    }

    // Φόρτωση με το που ανοίγει η σελίδα
    loadMyAds();
    loadRequests();
});