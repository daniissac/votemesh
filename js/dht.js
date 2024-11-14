export class DHTNode {
    constructor() {
        this.nodeId = this.generateNodeId();
        this.routingTable = new Map();
        this.storage = new Map();
        this.k = 20;
        this.maxAge = 3600000; // 1 hour
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
        this.storage.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    get(key) {
        const data = this.storage.get(key);
        if (data && Date.now() - data.timestamp < this.maxAge) {
            return data.value;
        }
        return null;
    }

    cleanup() {
        clearInterval(this.pingInterval);
        clearInterval(this.cleanupInterval);
    }
}