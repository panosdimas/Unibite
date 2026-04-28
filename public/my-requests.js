document.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userData);
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

    const historyList = document.getElementById('history-list');

    async function loadHistory() {
        try {
            const response = await fetch(`/api/consumer-requests/${user.id}`);
            const requests = await response.json();
            
            historyList.innerHTML = '';

            if (requests.length === 0) {
                historyList.innerHTML = '<p>Δεν έχεις κάνει κανένα αίτημα ακόμα.</p>';
                return;
            }

            requests.forEach(req => {
                const card = document.createElement('div');
                card.className = 'req-card';

                // Μετάφραση Status σε Ελληνικά
                let statusText = '';
                if (req.request_status === 'pending') statusText = 'Σε αναμονή...';
                else if (req.request_status === 'accepted') statusText = '<span style="color:blue;">Εγκρίθηκε - Πήγαινε να το πάρεις!</span>';
                else if (req.request_status === 'rejected') statusText = '<span style="color:red;">Απορρίφθηκε</span>';
                else if (req.request_status === 'not_show') statusText = '<span style="color:red;">Δεν εμφανίστηκες (-1 πόντος)</span>';
                else if (req.request_status === 'completed') statusText = '<span style="color:green;">Ολοκληρώθηκε</span>';

                // Αν ολοκληρώθηκε και ΔΕΝ έχει αξιολογηθεί, δείξε τη φόρμα αξιολόγησης
                let reviewHTML = '';
                if (req.request_status === 'completed') {
                    if (req.review_rating) {
                        reviewHTML = `<div class="review-box"><strong>Η βαθμολογία σου:</strong> ${req.review_rating}/5 <br> <em>"${req.review_text || ''}"</em></div>`;
                    } else {
                        reviewHTML = `
                            <div class="review-box" id="review-form-${req.request_id}">
                                <strong>Αξιολόγησε τον μάγειρα:</strong><br>
                                <select id="rating-${req.request_id}" style="margin: 5px 0; padding: 5px;">
                                    <option value="5">5 - Εξαιρετικό!</option>
                                    <option value="4">4 - Πολύ καλό</option>
                                    <option value="3">3 - Μέτριο</option>
                                    <option value="2">2 - Κακό</option>
                                    <option value="1">1 - Τραγικό</option>
                                </select><br>
                                <textarea id="text-${req.request_id}" rows="2" style="width: 100%; margin-bottom: 5px;" placeholder="Γράψε ένα σχόλιο (προαιρετικό)"></textarea>
                                <button class="submit-review-btn" data-reqid="${req.request_id}">Υποβολή Αξιολόγησης</button>
                            </div>
                        `;
                    }
                }

                card.innerHTML = `
                    <h3 style="margin-top: 0;">${req.ad_title}</h3>
                    <p><strong>Μάγειρας:</strong> ${req.cook_name}</p>
                    <p><strong>Κατάσταση:</strong> ${statusText}</p>
                    ${reviewHTML}
                `;
                
                historyList.appendChild(card);
            });

            // Συνδέουμε τα κουμπιά αξιολόγησης
            const reviewBtns = document.querySelectorAll('.submit-review-btn');
            reviewBtns.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const reqId = e.target.getAttribute('data-reqid');
                    const rating = document.getElementById(`rating-${reqId}`).value;
                    const text = document.getElementById(`text-${reqId}`).value;

                    try {
                        const res = await fetch(`/api/requests/${reqId}/review`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ rating, text })
                        });
                        
                        if (res.ok) {
                            alert('Σε ευχαριστούμε για την αξιολόγηση!');
                            loadHistory(); // Ξαναφορτώνει για να δείξει το σχόλιο και να κρύψει τη φόρμα
                        }
                    } catch (err) {
                        console.error('Σφάλμα αξιολόγησης:', err);
                    }
                });
            });

        } catch (error) {
            console.error('Σφάλμα:', error);
        }
    }

    loadHistory();
});