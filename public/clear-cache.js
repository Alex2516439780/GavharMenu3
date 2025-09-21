// Force clear cache and reload
console.log('Clearing cache and reloading...');

// Clear all caches
if ('caches' in window) {
    caches.keys().then(function(names) {
        for (let name of names) {
            caches.delete(name);
        }
        console.log('All caches cleared');
    });
}

// Clear localStorage
localStorage.clear();
console.log('localStorage cleared');

// Clear sessionStorage
sessionStorage.clear();
console.log('sessionStorage cleared');

// Force reload with cache busting
window.location.reload(true);
