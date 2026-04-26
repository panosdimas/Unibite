@echo off
title MySQL Auto-Login (Greek Support)

:: 1. Αλλαγή κωδικοποίησης κονσόλας σε UTF-8 για τα Ελληνικά
chcp 65001 > nul
echo.
echo ======================================================
echo   ETOIMO! Ta Ellinika rithmistikan.
echo   Syndesi stin MySQL...
echo ======================================================
echo.

:: 2. Εντολή σύνδεσης
:: Αν το username σου δεν είναι 'root', άλλαξε το παρακάτω.
:: Η εντολή αυτή φορτώνει τα ελληνικά ανεξάρτητα από το my.ini
mysql -u root -p --default-character-set=utf8mb4

:: 3. Παύση για να δεις τυχόν λάθη αν κλείσει απότομα
pause