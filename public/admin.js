document.addEventListener('DOMContentLoaded', () => {
    const userData = localStorage.getItem('user');
    if (!userData) {
        window.location.href = 'index.html';
        return;
    }

    const user = JSON.parse(userData);

    // ΑΣΦΑΛΕΙΑ: Αν δεν είναι admin, τον πετάμε έξω!
    if (user.role !== 'admin') {
        alert('Δεν έχετε δικαιώματα διαχειριστή!');
        window.location.href = 'dashboard.html';
        return;
    }

    document.getElementById('admin-name').textContent = `Διαχειριστής: ${user.username}`;

    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    });

    // Φόρτωση Στατιστικών
    async function loadStats() {
        try {
            // 1. Μερίδες Μήνα
            const resStats = await fetch('/api/admin/stats/monthly');
            const dataStats = await resStats.json();
            document.getElementById('total-portions').textContent = dataStats.total;

            // 2. Top Donor
            const resDonor = await fetch('/api/admin/stats/top-donor');
            const dataDonor = await resDonor.json();
            if (dataDonor) {
                document.getElementById('top-donor-name').textContent = dataDonor.username;
                document.getElementById('top-donor-count').textContent = `Μερίδες: ${dataDonor.shared_portions}`;
            } else {
                document.getElementById('top-donor-name').textContent = 'Κανένας ακόμα';
            }

            // 3. Top Meals
            const resMeals = await fetch('/api/admin/stats/top-meals');
            const dataMeals = await resMeals.json();
            const mealsList = document.getElementById('top-meals-list');
            
            if (dataMeals.length === 0) {
                mealsList.innerHTML = '<tr><td colspan="3" style="text-align:center;">Δεν υπάρχουν αξιολογήσεις ακόμα.</td></tr>';
            } else {
                dataMeals.forEach(meal => {
                    const row = document.createElement('tr');
                    // Μετατρέπουμε τον μέσο όρο π.χ. "4.5000" σε "4.5"
                    const rating = Number(meal.avg_rating).toFixed(1); 
                    row.innerHTML = `
                        <td>${meal.title}</td>
                        <td>${meal.cook_name}</td>
                        <td>⭐ ${rating} / 5</td>
                    `;
                    mealsList.appendChild(row);
                });
            }

        } catch (error) {
            console.error('Σφάλμα φόρτωσης admin panel:', error);
        }
    }

    loadStats();
});