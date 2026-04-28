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
        
        if (isLoginMode) {
            formTitle.textContent = 'Σύνδεση στο UniBite';
            submitBtn.textContent = 'Είσοδος';
            toggleModeBtn.textContent = 'Δεν έχετε λογαριασμό; Εγγραφείτε εδώ.';
        } else {
            formTitle.textContent = 'Εγγραφή στο UniBite';
            submitBtn.textContent = 'Εγγραφή';
            toggleModeBtn.textContent = 'Έχετε ήδη λογαριασμό; Συνδεθείτε εδώ.';
        }
    });

    // Υποβολή της φόρμας
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Αποτροπή ανανέωσης της σελίδας

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

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