class PeerDiscovery extends EventEmitter {
    constructor() {
        super();
        this.dht = null;
        this.peers = new Set();
        this.bootstrapNodes = [
            // List of known bootstrap nodes
            '0x1234567890abcdef',
            '0xabcdef1234567890'
        ];
    }

    async joinNetwork(nodeId) {
        this.dht = new DHTNode(nodeId);
        
        for (const bootstrapId of this.bootstrapNodes) {
            try {
                const peers = await this.dht.findNode(bootstrapId);
                peers.forEach(peer => this.connectToPeer(peer));
            } catch (error) {
                continue;
            }
        }
    }

    async connectToPeer(peerId) {
        if (!this.peers.has(peerId)) {
            this.peers.add(peerId);
            this.emit('peerDiscovered', peerId);
        }
    }

    broadcastPoll(pollData) {
        const pollId = pollData.id;
        this.dht.store(pollId, pollData);
        Array.from(this.peers).forEach(peerId => {
            this.emit('pollBroadcast', peerId, pollData);
        });
        return pollId;
    }

    findPoll(pollId) {
        return this.dht.get(pollId);
    }
}