// Storage Manager for VoteMesh
class StorageManager {
    constructor() {
        this.dbName = 'votemesh';
        this.dbVersion = 1;
        this.db = null;
        this.ready = false;
        this.initPromise = null;
    }

    // IndexedDB initialization
    async initializeIndexedDB() {
        if (this.ready) return Promise.resolve();
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            try {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = () => {
                    console.error('Failed to open database:', request.error);
                    this.ready = false;
                    reject(request.error);
                };

                request.onsuccess = () => {
                    this.db = request.result;
                    this.ready = true;
                    console.log('Database initialized successfully');
                    resolve();
                };

                request.onupgradeneeded = (event) => {
                    console.log('Upgrading database...');
                    const db = event.target.result;
                    
                    // Polls store
                    if (!db.objectStoreNames.contains('polls')) {
                        const pollStore = db.createObjectStore('polls', { keyPath: 'id' });
                        pollStore.createIndex('createdAt', 'createdAt', { unique: false });
                    }

                    // Templates store
                    if (!db.objectStoreNames.contains('templates')) {
                        db.createObjectStore('templates', { keyPath: 'id' });
                    }

                    // Analytics store
                    if (!db.objectStoreNames.contains('analytics')) {
                        const analyticsStore = db.createObjectStore('analytics', { keyPath: 'pollId' });
                        analyticsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    }
                };
            } catch (error) {
                console.error('Error initializing database:', error);
                this.ready = false;
                reject(error);
            }
        });

        return this.initPromise;
    }

    // Check if database is ready
    async ensureReady() {
        if (!this.ready) {
            await this.initializeIndexedDB();
        }
    }

    // LocalStorage Methods
    setLocalItem(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('LocalStorage error:', error);
            return false;
        }
    }

    getLocalItem(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('LocalStorage error:', error);
            return null;
        }
    }

    // IndexedDB Methods
    async savePoll(poll) {
        return this.saveToStore('polls', poll);
    }

    async getPoll(id) {
        return this.getFromStore('polls', id);
    }

    async saveTemplate(template) {
        return this.saveToStore('templates', template);
    }

    async getTemplate(id) {
        return this.getFromStore('templates', id);
    }

    async saveAnalytics(analytics) {
        return this.saveToStore('analytics', analytics);
    }

    async getAnalytics(pollId) {
        return this.getFromStore('analytics', pollId);
    }

    // Generic IndexedDB operations with ready check
    async saveToStore(storeName, data) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readwrite');
                const store = transaction.objectStore(storeName);
                const request = store.put(data);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getFromStore(storeName, key) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.get(key);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    async getAllFromStore(storeName) {
        await this.ensureReady();
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(storeName, 'readonly');
                const store = transaction.objectStore(storeName);
                const request = store.getAll();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    // Export/Import functionality
    async exportData() {
        const data = {
            polls: await this.getAllFromStore('polls'),
            templates: await this.getAllFromStore('templates'),
            analytics: await this.getAllFromStore('analytics'),
            localStorage: this.getAllLocalStorage()
        };
        return JSON.stringify(data);
    }

    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            // Import to IndexedDB
            await this.importToStore('polls', data.polls);
            await this.importToStore('templates', data.templates);
            await this.importToStore('analytics', data.analytics);

            // Import to localStorage
            this.importLocalStorage(data.localStorage);
            
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }

    // Helper methods
    async importToStore(storeName, items) {
        const transaction = this.db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        for (const item of items) {
            await new Promise((resolve, reject) => {
                const request = store.put(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    getAllLocalStorage() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            data[key] = this.getLocalItem(key);
        }
        return data;
    }

    importLocalStorage(data) {
        for (const [key, value] of Object.entries(data)) {
            this.setLocalItem(key, value);
        }
    }
}

// Create and export a singleton instance
const storageManager = new StorageManager();
window.storageManager = storageManager; // Make it globally available
