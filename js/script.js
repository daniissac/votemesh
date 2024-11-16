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
    if (!pollId) return;

    // First try to get the poll from local storage
    let poll = pollManager.getPoll(pollId);
    
    if (!poll) {
        // If not found locally, try to find it in the DHT
        try {
            poll = await discovery.findPoll(pollId);
            if (poll) {
                pollManager.handlePollMessage(poll);
                poll = pollManager.getPoll(pollId); // Get the poll from manager after handling
            }
        } catch (error) {
            console.warn('Failed to find poll:', error);
        }
    }

    if (poll) {
        uiManager.displayPoll(poll);
    } else {
        console.warn('Poll not found:', pollId);
        // Optional: Show a user-friendly message that the poll wasn't found
        document.getElementById('voter-section').innerHTML = `
            <div class="p-4 text-center">
                <h2 class="text-xl font-semibold mb-2">Poll Not Found</h2>
                <p class="text-gray-600">The poll you're looking for doesn't exist or hasn't been synchronized yet.</p>
                <p class="text-gray-600">Please try again in a few moments.</p>
            </div>
        `;
        document.getElementById('voter-section').classList.remove('hidden');
        document.getElementById('creator-section').classList.add('hidden');
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
window.createPoll = () => {
    const question = document.getElementById('question').value;
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value.trim())
        .filter(Boolean);

    if (!question || options.length < 2) {
        alert('Please enter a question and at least 2 options');
        return;
    }

    try {
        const poll = pollManager.createPoll(question, options);
        uiManager.displayPoll(poll);
        return poll;
    } catch (error) {
        console.error('Failed to create poll:', error);
        alert('Failed to create poll. Please try again.');
    }
};

window.addOption = () => {
    uiManager.addOption();
};

window.copyShareUrl = () => {
    uiManager.copyShareUrl();
};
