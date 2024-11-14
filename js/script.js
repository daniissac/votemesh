import { DHTNode } from './dht.js';
import { PeerDiscovery } from './peer-discovery.js';
import { PollManager } from './poll.js';
import { UIManager } from './ui-manager.js';

let discovery, pollManager, uiManager;

export async function initializeVoteMesh() {
    try {
        // Initialize core components
        discovery = new PeerDiscovery();
        pollManager = new PollManager(discovery);
        uiManager = new UIManager(pollManager);

        // Set up network event handlers
        discovery.on('peerConnected', (peerId) => {
            uiManager.updateNetworkStatus(discovery.peers.size, 'Connected');
        });

        discovery.on('peerMessage', (peerId, message) => {
            handlePeerMessage(peerId, message);
        });

        // Join the network
        await discovery.joinNetwork();
        
        // Check for poll ID in URL
        handleUrlHash();
        
        // Listen for URL changes
        window.addEventListener('hashchange', handleUrlHash);

    } catch (error) {
        console.error('Failed to initialize VoteMesh:', error);
        uiManager.updateNetworkStatus(0, 'Failed to Connect');
    }
}

async function handleUrlHash() {
    const pollId = window.location.hash.substring(1);
    if (pollId) {
        const poll = await discovery.findPoll(pollId);
        if (poll) {
            pollManager.displayPoll(poll);
        }
    }
}

function handlePeerMessage(peerId, message) {
    switch (message.type) {
        case 'POLL':
            pollManager.handlePollMessage(message.data);
            break;
        case 'VOTE':
            pollManager.handleVoteMessage(message.data);
            break;
        case 'SYNC':
            pollManager.handleSyncMessage(message.data);
            break;
        default:
            console.warn('Unknown message type:', message.type);
    }
}

// Make necessary functions available globally
window.createPoll = (question, options) => {
    return pollManager.createPoll(question, options);
};

window.addOption = () => {
    uiManager.addOption();
};

window.copyShareUrl = () => {
    uiManager.copyShareUrl();
};
