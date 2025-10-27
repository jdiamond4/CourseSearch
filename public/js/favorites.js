// Favorites management using localStorage
const STORAGE_KEY = 'hoosList_favorites';

// Get favorites from localStorage
function getFavorites() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : { courses: [] };
    } catch (error) {
        console.error('Error reading favorites:', error);
        return { courses: [] };
    }
}

// Save favorites to localStorage
function saveFavorites(favorites) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
        updateFavoriteBadge();
    } catch (error) {
        console.error('Error saving favorites:', error);
    }
}

// Add a course to favorites
function addFavorite(courseData) {
    const favorites = getFavorites();
    
    // Check if already exists
    const exists = favorites.courses.some(c => c.courseId === courseData.courseId);
    if (exists) {
        return;
    }
    
    favorites.courses.push(courseData);
    saveFavorites(favorites);
    updateFavoriteButtons();
}

// Remove a course from favorites
function removeFavorite(courseId) {
    const favorites = getFavorites();
    favorites.courses = favorites.courses.filter(c => c.courseId !== courseId);
    saveFavorites(favorites);
    updateFavoriteButtons();
}

// Check if a course is favorited
function isFavorited(courseId) {
    const favorites = getFavorites();
    return favorites.courses.some(c => c.courseId === courseId);
}

// Toggle favorite status
function toggleFavorite(courseData) {
    if (isFavorited(courseData.courseId)) {
        removeFavorite(courseData.courseId);
    } else {
        addFavorite(courseData);
    }
}

// Update all favorite button states on the page
function updateFavoriteButtons() {
    const buttons = document.querySelectorAll('.favorite-btn');
    buttons.forEach(button => {
        const courseId = button.dataset.courseId;
        if (isFavorited(courseId)) {
            button.innerHTML = '★'; // Filled star
            button.classList.add('favorited');
        } else {
            button.innerHTML = '☆'; // Empty star
            button.classList.remove('favorited');
        }
    });
    updateFavoriteBadge();
}

// Update the favorite count badge in the header
function updateFavoriteBadge() {
    const favorites = getFavorites();
    const count = favorites.courses.length;
    const badge = document.getElementById('favorite-count-badge');
    
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Initialize favorites on page load
document.addEventListener('DOMContentLoaded', function() {
    updateFavoriteButtons();
    updateFavoriteBadge();
});


