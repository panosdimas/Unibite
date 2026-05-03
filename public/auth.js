document.addEventListener('DOMContentLoaded', () => {
    const authForm = document.getElementById('auth-form');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const toggleModeBtn = document.getElementById('toggle-mode');
    const messageDiv = document.getElementById('message');

    let isLoginMode = true; // Ξεκινάμε με τη φόρμα Σύνδεσης

    // Εναλλαγή μεταξύ Login και Register
    toggleModeBtn.addEventListener('click', () => {
        isLoginMode = !isLoginMode;
        messageDiv.textContent = '';
        messageDiv.className = '';
        
        const confirmGroup = document.getElementById('confirm-password-group');
        const confirmInput = document.getElementById('confirm-password');

        if (isLoginMode) {
            formTitle.textContent = 'Σύνδεση στο UniBite';
            submitBtn.textContent = 'Είσοδος';
            toggleModeBtn.textContent = 'Δεν έχετε λογαριασμό; Εγγραφείτε εδώ.';
            confirmGroup.style.display = 'none'; // Κρύβουμε το 2ο password
            confirmInput.required = false;       // Δεν είναι υποχρεωτικό
        } else {
            formTitle.textContent = 'Εγγραφή στο UniBite';
            submitBtn.textContent = 'Εγγραφή';
            toggleModeBtn.textContent = 'Έχετε ήδη λογαριασμό; Συνδεθείτε εδώ.';
            confirmGroup.style.display = 'block'; // Εμφανίζουμε το 2ο password
            confirmInput.required = true;         // Το κάνουμε υποχρεωτικό
        }
    });

    // Υποβολή της φόρμας
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Αποτροπή ανανέωσης της σελίδας

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value; // Παίρνουμε τον 2ο κωδικό

        // --- ΕΛΕΓΧΟΣ ΤΑΥΤΙΣΗΣ ΚΩΔΙΚΩΝ (Μόνο στην Εγγραφή) ---
        if (!isLoginMode && password !== confirmPassword) {
            messageDiv.textContent = 'Οι κωδικοί δεν ταιριάζουν. Παρακαλώ ελέγξτε τους ξανά.';
            messageDiv.className = 'error-message';
            return; // Σταματάμε εδώ, ΔΕΝ στέλνουμε τίποτα στον Server!
        }
        const endpoint = isLoginMode ? '/api/login' : '/api/register';

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                messageDiv.textContent = data.message;
                messageDiv.className = 'success-message';
                
                if (isLoginMode) {
                    // Αποθήκευση στοιχείων χρήστη στο localStorage
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    // TODO: Ανακατεύθυνση στο κεντρικό dashboard ανάλογα με το ρόλο
                    setTimeout(() => {
                        window.location.href = 'dashboard.html'; 
                    }, 1000);
                } else {
                    // Μετά από επιτυχή εγγραφή, γυρνάμε σε Login mode
                    setTimeout(() => toggleModeBtn.click(), 1500);
                }
            } else {
                messageDiv.textContent = data.message;
                messageDiv.className = 'error-message';
            }
        } catch (error) {
            console.error('Σφάλμα δικτύου:', error);
            messageDiv.textContent = 'Προέκυψε σφάλμα σύνδεσης με τον server.';
            messageDiv.className = 'error-message';
        }
    });
});