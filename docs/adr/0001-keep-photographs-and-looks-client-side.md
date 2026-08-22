# Keep photographs and Looks client-side

OpenFilm processes photographs in the browser and has no application backend. IndexedDB stores custom Looks and the latest recoverable Edit, but users should not treat browser storage as a durable backup. This keeps the project private by default, deployable as static files, and free to operate.
