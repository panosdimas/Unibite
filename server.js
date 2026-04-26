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
app.listen(PORT, () => {
    console.log(`Ο Server τρέχει στο: http://localhost:${PORT}`);
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
