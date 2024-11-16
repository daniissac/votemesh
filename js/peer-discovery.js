import { DHTNode } from './dht.js';
import { EventEmitter } from './event-emitter.js';
import { WebRTCConnection } from './webrtc.js';

export class PeerDiscovery extends EventEmitter {
    constructor() {
        super();
        this.dht = new DHTNode();
        this.peers = new Map();
        this.connecting = new Set();
        this.maxPeers = 10;
        this.reconnectDelay = 5000;
    }

    async joinNetwork() {
        try {
            // Get initial peers from DHT
            const peers = await this.dht.findNode(this.dht.nodeId);
            
            // Connect to discovered peers
            for (const peer of peers) {
                await this.connectToPeer(peer.id);
            }

            // Start peer discovery loop
            this.startPeerDiscovery();
            
            this.emit('networkJoined');
            return true;
        } catch (error) {
            console.error('Failed to join network:', error);
            throw error;
        }
    }

    async connectToPeer(peerId) {
        if (this.peers.has(peerId) || this.connecting.has(peerId)) {
            return;
        }

        this.connecting.add(peerId);

        try {
            const connection = new WebRTCConnection(peerId, this);
            
            // Set up message handler
            connection.onMessage = (data) => {
                this.emit('peerMessage', peerId, data);
            };

            await connection.connect();
            
            this.peers.set(peerId, connection);
            this.emit('peerConnected', peerId);
            
        } catch (error) {
            console.warn(`Failed to connect to peer ${peerId}:`, error);
            setTimeout(() => {
                this.connecting.delete(peerId);
            }, this.reconnectDelay);
        }
    }

    broadcastPoll(pollData) {
        console.log('Broadcasting poll to peers:', pollData.id);
        const message = {
            type: 'POLL',
            data: pollData
        };

        this.broadcast(message);
        console.log('Storing poll in DHT:', pollData.id);
        this.dht.store(pollData.id, pollData);
        return pollData.id;
    }

    broadcastVote(pollId, option) {
        const message = {
            type: 'VOTE',
            data: { pollId, option }
        };

        this.broadcast(message);
    }

    broadcast(message) {
        this.peers.forEach(connection => {
            connection.send(JSON.stringify(message));
        });
    }

    async findPoll(pollId) {
        console.log('Searching for poll in DHT:', pollId);
        const poll = await this.dht.get(pollId);
        console.log('DHT search result:', poll);
        return poll;
    }

    startPeerDiscovery() {
        setInterval(() => {
            if (this.peers.size < this.maxPeers) {
                this.discoverNewPeers();
            }
        }, 30000); // Every 30 seconds
    }

    async discoverNewPeers() {
        const peers = await this.dht.findNode(this.dht.nodeId);
        for (const peer of peers) {
            if (!this.peers.has(peer.id)) {
                this.connectToPeer(peer.id);
            }
        }
    }

    disconnect() {
        this.peers.forEach(connection => connection.close());
        this.peers.clear();
        this.connecting.clear();
        this.dht.cleanup();
    }
}