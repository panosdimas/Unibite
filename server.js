const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'ceid',
    database: 'unibitedb'
};
let db;

async function connectDB() {
    try {
        db = await mysql.createConnection(dbConfig);
        console.log('Η βάση συνδέθηκε επιτυχώς.');
    } catch (err) {
        console.error('Σφάλμα σύνδεσης με τη βάση:', err);
    }
}
connectDB();

//SIGNUP
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Συμπληρώστε όνομα και κωδικό.' });
    }

    try {
        const [existing] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(409).json({ message: 'Το όνομα χρήστη υπάρχει ήδη.' });
        }
        await db.execute('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
        res.status(201).json({ message: 'Η εγγραφή ολοκληρώθηκε!' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα!' });
    }
});

const PORT = 3000;

// ΔΗΜΙΟΥΡΓΙΑ ΑΓΓΕΛΙΑΣ (CREATE AD) - Με Χάρτη
app.post('/api/ads', async (req, res) => {
    const { cook_id, title, notes, allergies, pickup_location, pickup_time, all_portions, g_platos, g_mikos } = req.body;

    if (!title || !pickup_location || !pickup_time || !all_portions || !g_platos || !g_mikos) {
        return res.status(400).json({ message: 'Συμπληρώστε τα υποχρεωτικά πεδία και επιλέξτε σημείο στον χάρτη.' });
    }

    try {
        const query = `
            INSERT INTO ads (cook_id, title, notes, allergies, pickup_location, pickup_time, all_portions, available_portions, g_platos, g_mikos) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await db.execute(query, [cook_id, title, notes, allergies, pickup_location, pickup_time, all_portions, all_portions, g_platos, g_mikos]);
        
        res.status(201).json({ message: 'Η αγγελία δημιουργήθηκε επιτυχώς!' });
    } catch (error) {
        console.error('Σφάλμα δημιουργίας αγγελίας:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα κατά την αποθήκευση.' });
    }
});

// ΠΡΟΒΟΛΗ ΑΓΓΕΛΙΩΝ ΜΑΓΕΙΡΑ (READ)
// ΠΡΟΒΟΛΗ ΑΓΓΕΛΙΩΝ ΜΑΓΕΙΡΑ (READ) - Μόνο όσες είναι < 48 ωρών
app.get('/api/ads/:cook_id', async (req, res) => {
    const cookId = req.params.cook_id;
    try {
        const [ads] = await db.execute('SELECT * FROM ads WHERE cook_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 48 HOUR) ORDER BY created_at DESC', [cookId]);
        res.status(200).json(ads);
    } catch (error) {
        console.error('Σφάλμα φόρτωσης αγγελιών:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα κατά τη φόρτωση των αγγελιών.' });
    }
});

// ΔΙΑΓΡΑΦΗ ΑΓΓΕΛΙΑΣ (DELETE)
app.delete('/api/ads/:id', async (req, res) => {
    const adId = req.params.id;
    try {
        await db.execute('DELETE FROM ads WHERE id = ?', [adId]);
        res.status(200).json({ message: 'Η αγγελία διαγράφηκε.' });
    } catch (error) {
        console.error('Σφάλμα διαγραφής αγγελίας:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα κατά τη διαγραφή.' });
    }
});

// ΕΠΕΞΕΡΓΑΣΙΑ ΑΓΓΕΛΙΑΣ (UPDATE) - Με Χάρτη
app.put('/api/ads/:id', async (req, res) => {
    const adId = req.params.id;
    const { title, all_portions, pickup_location, pickup_time, allergies, notes, g_platos, g_mikos } = req.body;

    try {
        const query = `
            UPDATE ads 
            SET title = ?, all_portions = ?, pickup_location = ?, pickup_time = ?, allergies = ?, notes = ?, g_platos = ?, g_mikos = ?
            WHERE id = ?
        `;
        await db.execute(query, [title, all_portions, pickup_location, pickup_time, allergies, notes, g_platos, g_mikos, adId]);
        res.status(200).json({ message: 'Η αγγελία ενημερώθηκε επιτυχώς!' });
    } catch (error) {
        console.error('Σφάλμα επεξεργασίας αγγελίας:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα κατά την επεξεργασία.' });
    }
});

// ΛΗΨΗ ΑΙΤΗΜΑΤΩΝ ΓΙΑ ΤΟΝ ΜΑΓΕΙΡΑ (COOK REQUESTS)
app.get('/api/cook-requests/:cook_id', async (req, res) => {
    const cookId = req.params.cook_id;
    try {
        const query = `
            SELECT r.id as request_id, r.request_status, u.username as consumer_name, a.title as ad_title, a.id as ad_id
            FROM requests r
            JOIN users u ON r.consumer_id = u.id
            JOIN ads a ON r.ad_id = a.id
            WHERE a.cook_id = ?
            ORDER BY r.id DESC
        `;
        const [requests] = await db.execute(query, [cookId]);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Σφάλμα φόρτωσης αιτημάτων:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

// ΕΝΗΜΕΡΩΣΗ ΚΑΤΑΣΤΑΣΗΣ ΑΙΤΗΜΑΤΟΣ (APPROVE / REJECT)
app.put('/api/requests/:id/status', async (req, res) => {
    const reqId = req.params.id;
    const { status, ad_id } = req.body; // status: 'accepted' ή 'rejected'

    try {
        await db.execute('UPDATE requests SET request_status = ? WHERE id = ?', [status, reqId]);
        
        // Αν το αίτημα γίνει αποδεκτό, μειώνουμε τις διαθέσιμες μερίδες της αγγελίας κατά 1
        if (status === 'accepted') {
            await db.execute('UPDATE ads SET available_portions = available_portions - 1 WHERE id = ? AND available_portions > 0', [ad_id]);
        }
        
        res.status(200).json({ message: 'Η κατάσταση του αιτήματος ενημερώθηκε!' });
    } catch (error) {
        console.error('Σφάλμα ενημέρωσης αιτήματος:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

// ΟΛΟΚΛΗΡΩΣΗ Ή ΑΚΥΡΩΣΗ ΣΥΝΑΝΤΗΣΗΣ (COMPLETED / NOT_SHOW)
app.put('/api/requests/:id/finalize', async (req, res) => {
    const reqId = req.params.id;
    const { status, consumer_id } = req.body; // Μπορεί να είναι 'completed' ή 'not_show'

    try {
        await db.execute('UPDATE requests SET request_status = ? WHERE id = ?', [status, reqId]);
        
        // Αν ο φοιτητής δεν εμφανίστηκε, του αφαιρούμε 1 πόντο
        if (status === 'not_show') {
            await db.execute('UPDATE users SET points = points - 1 WHERE id = ?', [consumer_id]);
        }
        
        res.status(200).json({ message: 'Η συνάντηση ενημερώθηκε επιτυχώς!' });
    } catch (error) {
        console.error('Σφάλμα ολοκλήρωσης:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

// ΙΣΤΟΡΙΚΟ ΑΙΤΗΜΑΤΩΝ ΚΑΤΑΝΑΛΩΤΗ (CONSUMER HISTORY)
app.get('/api/consumer-requests/:consumer_id', async (req, res) => {
    const consumerId = req.params.consumer_id;
    try {
        const query = `
            SELECT r.id as request_id, r.request_status, r.review_rating, r.review_text, 
                   a.title as ad_title, u.username as cook_name
            FROM requests r
            JOIN ads a ON r.ad_id = a.id
            JOIN users u ON a.cook_id = u.id
            WHERE r.consumer_id = ?
            ORDER BY r.id DESC
        `;
        const [requests] = await db.execute(query, [consumerId]);
        res.status(200).json(requests);
    } catch (error) {
        console.error('Σφάλμα φόρτωσης ιστορικού:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

// ΥΠΟΒΟΛΗ ΑΞΙΟΛΟΓΗΣΗΣ ΚΑΙ ΑΠΟΔΟΣΗ ΠΟΝΤΩΝ
app.put('/api/requests/:id/review', async (req, res) => {
    const reqId = req.params.id;
    const { rating, text } = req.body;

    try {
        // 1. Αποθηκεύουμε την αξιολόγηση
        await db.execute('UPDATE requests SET review_rating = ?, review_text = ? WHERE id = ?', [rating, text, reqId]);
        
        // 2. Αν η βαθμολογία είναι > 3, δίνουμε 1 πόντο στον Μάγειρα!
        if (rating > 3) {
            // Βρίσκουμε ποιος είναι ο μάγειρας αυτού του αιτήματος
            const queryCook = `
                SELECT a.cook_id 
                FROM requests r 
                JOIN ads a ON r.ad_id = a.id 
                WHERE r.id = ?
            `;
            const [rows] = await db.execute(queryCook, [reqId]);
            if (rows.length > 0) {
                const cookId = rows[0].cook_id;
                // Δίνουμε τον πόντο
                await db.execute('UPDATE users SET points = points + 1 WHERE id = ?', [cookId]);
            }
        }
        
        res.status(200).json({ message: 'Η αξιολόγηση υποβλήθηκε επιτυχώς!' });
    } catch (error) {
        console.error('Σφάλμα υποβολής αξιολόγησης:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

// --- ADMIN ENDPOINTS ---

// 1. Στατιστικά: Συνολικές μερίδες που διαμοιράστηκαν τον τελευταίο μήνα
app.get('/api/admin/stats/monthly', async (req, res) => {
    try {
        // Θεωρούμε 1 ολοκληρωμένο αίτημα = 1 διαμοιρασμένη μερίδα
        const query = `
            SELECT COUNT(*) as total_portions 
            FROM requests 
            WHERE request_status = 'completed' 
            AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
        `;
        const [rows] = await db.execute(query);
        res.status(200).json({ total: rows[0].total_portions || 0 });
    } catch (error) {
        console.error('Σφάλμα στατιστικών:', error);
        res.status(500).json({ message: 'Σφάλμα' });
    }
});

// 2. Top Donor: Αυτός που έδωσε τις περισσότερες μερίδες (ολοκληρωμένα αιτήματα)
app.get('/api/admin/stats/top-donor', async (req, res) => {
    try {
        const query = `
            SELECT u.username, COUNT(r.id) as shared_portions
            FROM users u
            JOIN ads a ON u.id = a.cook_id
            JOIN requests r ON a.id = r.ad_id
            WHERE r.request_status = 'completed'
            GROUP BY u.id
            ORDER BY shared_portions DESC
            LIMIT 1
        `;
        const [rows] = await db.execute(query);
        res.status(200).json(rows.length > 0 ? rows[0] : null);
    } catch (error) {
        console.error('Σφάλμα Top Donor:', error);
        res.status(500).json({ message: 'Σφάλμα' });
    }
});

// 3. Top Meals: Τα γεύματα με την υψηλότερη μέση αξιολόγηση
app.get('/api/admin/stats/top-meals', async (req, res) => {
    try {
        const query = `
            SELECT a.title, u.username as cook_name, AVG(r.review_rating) as avg_rating
            FROM requests r
            JOIN ads a ON r.ad_id = a.id
            JOIN users u ON a.cook_id = u.id
            WHERE r.review_rating IS NOT NULL
            GROUP BY a.id
            ORDER BY avg_rating DESC
            LIMIT 5
        `;
        const [rows] = await db.execute(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Σφάλμα Top Meals:', error);
        res.status(500).json({ message: 'Σφάλμα' });
    }
});

// FEED: ΠΡΟΒΟΛΗ ΟΛΩΝ ΤΩΝ ΑΓΓΕΛΙΩΝ (Των τελευταίων 48 ωρών)
app.get('/api/feed', async (req, res) => {
    try {
        const query = `
            SELECT ads.*, users.username as cook_name 
            FROM ads 
            JOIN users ON ads.cook_id = users.id 
            WHERE TIMESTAMPDIFF(HOUR, ads.created_at, NOW()) <= 48
            ORDER BY ads.created_at DESC
        `;
        const [ads] = await db.execute(query);
        res.status(200).json(ads);
    } catch (error) {
        console.error('Σφάλμα φόρτωσης feed:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

// ΔΗΜΙΟΥΡΓΙΑ ΑΙΤΗΜΑΤΟΣ (REQUEST PORTION)
app.post('/api/requests', async (req, res) => {
    const { ad_id, consumer_id } = req.body;
    try {
        // 1. Έλεγχος αν ο καταναλωτής έχει τουλάχιστον 1 πόντο
        const [users] = await db.execute('SELECT points FROM users WHERE id = ?', [consumer_id]);
        if (users[0].points < 1) {
            return res.status(400).json({ message: 'Δεν έχετε αρκετούς πόντους για να ζητήσετε μερίδα.' });
        }

        // 2. Έλεγχος αν η αγγελία έχει διαθέσιμες μερίδες
        const [ads] = await db.execute('SELECT available_portions FROM ads WHERE id = ?', [ad_id]);
        if (ads[0].available_portions < 1) {
            return res.status(400).json({ message: 'Οι μερίδες έχουν εξαντληθεί!' });
        }

        // 3. Έλεγχος αν έχει ήδη κάνει αίτημα στη συγκεκριμένη αγγελία
        const [existing] = await db.execute('SELECT * FROM requests WHERE ad_id = ? AND consumer_id = ?', [ad_id, consumer_id]);
        if (existing.length > 0) {
             return res.status(400).json({ message: 'Έχετε ήδη ζητήσει μερίδα από αυτή την αγγελία.' });
        }

        // 4. Καταχώρηση του αιτήματος στη Βάση με status 'pending' (εκκρεμές)
        await db.execute('INSERT INTO requests (ad_id, consumer_id, request_status) VALUES (?, ?, "pending")', [ad_id, consumer_id]);
        
        res.status(201).json({ message: 'Το αίτημα στάλθηκε με επιτυχία στον μάγειρα!' });
    } catch (error) {
        console.error('Σφάλμα δημιουργίας αιτήματος:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα.' });
    }
});

//LOGIN
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ message: 'Παρακαλώ συμπληρώστε όνομα και κωδικό.' });
    }
    try {
        const [users] = await db.execute('SELECT * FROM users WHERE username = ?', [username]);
        if (users.length === 0) {
            return res.status(401).json({ message: 'Λάθος όνομα χρήστη ή κωδικός.' });
        }
        const user = users[0];
        if (user.password !== password) {
            return res.status(401).json({ message: 'Λάθος όνομα χρήστη ή κωδικός.' });
        }
        res.status(200).json({
            message: 'Επιτυχής σύνδεση!',
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
                points: user.points
            }
        });
    } catch (error) {
        console.error('Σφάλμα κατά το login:', error);
        res.status(500).json({ message: 'Προέκυψε σφάλμα!' });
    }
});

// ΕΛΕΓΧΟΣ ΚΑΙ ΕΠΙΒΟΛΗ ΠΟΙΝΩΝ (Τρέχει στο παρασκήνιο)
app.post('/api/check-penalties', async (req, res) => {
    try {
        // Αφαιρεί 1 πόντο και βάζει review_rating = 0 (ως σημάδι ότι τιμωρήθηκε για να μην ξαναχάσει πόντο)
        const query = `
            UPDATE users u
            JOIN requests r ON u.id = r.consumer_id
            SET u.points = u.points - 1, r.review_rating = 0 
            WHERE r.request_status = 'completed' 
            AND r.review_rating IS NULL 
            AND r.created_at <= DATE_SUB(NOW(), INTERVAL 48 HOUR)
        `;
        await db.execute(query);
        res.status(200).json({ message: 'Ο έλεγχος ποινών ολοκληρώθηκε.' });
    } catch (error) {
        console.error('Σφάλμα ελέγχου ποινών:', error);
        res.status(500).json({ message: 'Σφάλμα.' });
    }
});

app.listen(PORT, () => {
    console.log(`Ο Server τρέχει στο: http://localhost:${PORT}`);
});