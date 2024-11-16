export class DHTNode {
    constructor() {
        this.nodeId = this.generateNodeId();
        this.routingTable = new Map();
        this.storage = new Map();
        this.k = 20;
        this.maxAge = 3600000; // 1 hour
        this.baseUrl = 'https://daniissac.com/votemesh/'; // Add base URL
        this.bootstrapNodes = [
            // Add some default bootstrap nodes
            { id: '0x1234567890abcdef', address: 'bootstrap1.votemesh.network' },
            { id: '0xabcdef1234567890', address: 'bootstrap2.votemesh.network' }
        ];
        this.initialize();
    }

    generateNodeId() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async initialize() {
        // Connect to bootstrap nodes
        for (const node of this.bootstrapNodes) {
            await this.connectToBootstrapNode(node);
        }
        
        // Start maintenance tasks
        this.pingInterval = setInterval(() => this.pingNodes(), 60000);
        this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
    }

    async connectToBootstrapNode(node) {
        try {
            const peers = await this.findNode(node.id);
            peers.forEach(peer => this.routingTable.set(peer.id, peer));
        } catch (error) {
            console.warn(`Failed to connect to bootstrap node ${node.id}:`, error);
        }
    }

    pingNodes() {
        this.routingTable.forEach((node, id) => {
            if (Date.now() - node.lastSeen > this.maxAge) {
                this.routingTable.delete(id);
            }
        });
    }

    distance(id1, id2) {
        return id1 ^ id2;
    }

    findNode(targetId) {
        return Array.from(this.routingTable.entries())
            .sort((a, b) => this.distance(a[0], targetId) - this.distance(b[0], targetId))
            .slice(0, this.k);
    }

    store(key, value) {
        console.log('DHT storing data for key:', key);
        
        // Ensure the value is properly structured
        const data = {
            value,
            timestamp: Date.now()
        };
        
        // Store in memory
        this.storage.set(key, data);
        
        // Store in localStorage with proper error handling
        try {
            const storageKey = `${this.baseUrl}:poll:${key}`;
            localStorage.setItem(storageKey, JSON.stringify(data));
            console.log('Successfully stored in localStorage:', storageKey);
            
            // Also store in the old format for backward compatibility
            localStorage.setItem(`votemesh:poll:${key}`, JSON.stringify(data));
        } catch (error) {
            console.warn('Failed to store in localStorage:', error);
        }
    }

    get(key) {
        console.log('DHT retrieving data for key:', key);
        
        // Try memory first
        const memData = this.storage.get(key);
        if (memData && Date.now() - memData.timestamp < this.maxAge) {
            console.log('Found in memory:', memData.value);
            return memData.value;
        }

        // Try localStorage with new format
        try {
            const storageKey = `${this.baseUrl}:poll:${key}`;
            let localData = localStorage.getItem(storageKey);
            
            // If not found, try old format
            if (!localData) {
                localData = localStorage.getItem(`votemesh:poll:${key}`);
            }
            
            if (localData) {
                const parsed = JSON.parse(localData);
                if (Date.now() - parsed.timestamp < this.maxAge) {
                    console.log('Found in localStorage:', parsed.value);
                    // Update memory cache
                    this.storage.set(key, parsed);
                    return parsed.value;
                } else {
                    // Clean up expired data
                    localStorage.removeItem(storageKey);
                    localStorage.removeItem(`votemesh:poll:${key}`);
                }
            }
        } catch (error) {
            console.warn('Failed to retrieve from localStorage:', error);
        }

        console.log('Data not found in DHT for key:', key);
        return null;
    }

    cleanup() {
        // Clean up expired items from localStorage
        try {
            Object.keys(localStorage)
                .filter(key => key.startsWith('votemesh:poll:'))
                .forEach(key => {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (Date.now() - data.timestamp >= this.maxAge) {
                        localStorage.removeItem(key);
                    }
                });
        } catch (error) {
            console.warn('Error during cleanup:', error);
        }
        
        // Clean up memory storage
        this.storage.forEach((data, key) => {
            if (Date.now() - data.timestamp >= this.maxAge) {
                this.storage.delete(key);
            }
        });

        clearInterval(this.pingInterval);
        clearInterval(this.cleanupInterval);
    }
}