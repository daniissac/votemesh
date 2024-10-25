class DHTNode {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.routingTable = new Map();
        this.storage = new Map();
        this.k = 20;
        this.maxAge = 3600000; // 1 hour TTL for stored data
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
}