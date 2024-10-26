import { DHTNode } from './dht.js';
import { WebRTCConnection } from './webrtc.js';
import { PeerDiscovery } from './peer-discovery.js';

let discovery;
let connections = new Map();
let currentPoll = null;

// Initialize the application
async function initializeVoteMesh() {
    const nodeId = generateNodeId();
    discovery = new PeerDiscovery();
    await discovery.joinNetwork(nodeId);
    setupEventListeners();
    handleUrlHash();
    updateNetworkStatus();
}

function generateNodeId() {
    return new Uint8Array(crypto.getRandomValues(new Uint8Array(32)))[0];
}

function setupEventListeners() {
    discovery.on('peerDiscovered', handlePeerDiscovery);
    discovery.on('pollBroadcast', handlePollBroadcast);
    window.addEventListener('hashchange', handleUrlHash);
    
    // UI Event Listeners
    document.getElementById('create-poll-btn').addEventListener('click', createPoll);
    document.getElementById('add-option-btn').addEventListener('click', addOption);
    document.getElementById('copy-url-btn').addEventListener('click', copyShareUrl);
}

async function handlePeerDiscovery(peerId) {
    const connection = new WebRTCConnection(peerId);
    connections.set(peerId, connection);
    await connection.connect();
    updateNetworkStatus();
}

function handlePollBroadcast(peerId, poll) {
    if (!currentPoll || poll.id !== currentPoll.id) {
        currentPoll = poll;
        displayPoll();
    }
}

function createPoll() {
    const question = document.getElementById('question').value;
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value.trim())
        .filter(Boolean);

    currentPoll = {
        id: crypto.randomUUID(),
        question,
        options,
        votes: Object.fromEntries(options.map(opt => [opt, 0])),
        timestamp: Date.now()
    };

    discovery.broadcastPoll(currentPoll);
    showVotingInterface();
}

function showVotingInterface() {
    document.getElementById('creator-section').classList.add('hidden');
    document.getElementById('voter-section').classList.remove('hidden');
    document.getElementById('share-section').classList.remove('hidden');
    
    const shareUrl = `${window.location.origin}/votemesh#${currentPoll.id}`;
    document.getElementById('share-url').value = shareUrl;
}

function submitVote(option) {
    currentPoll.votes[option]++;
    broadcastVote(option);
    displayResults();
}

function broadcastVote(option) {
    const voteData = {
        pollId: currentPoll.id,
        option
    };
    
    connections.forEach(connection => {
        connection.send(JSON.stringify({
            type: 'VOTE',
            data: voteData
        }));
    });
}

function displayPoll() {
    if (!currentPoll) return;
    
    document.getElementById('poll-question').textContent = currentPoll.question;
    const optionsContainer = document.getElementById('poll-options');
    optionsContainer.innerHTML = '';
    
    currentPoll.options.forEach(option => {
        const button = document.createElement('button');
        button.className = 'w-full p-3 bg-gray-100 hover:bg-gray-200 rounded text-left';
        button.textContent = option;
        button.onclick = () => submitVote(option);
        optionsContainer.appendChild(button);
    });
    
    displayResults();
}

function displayResults() {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = '';
    
    const total = Object.values(currentPoll.votes).reduce((a, b) => a + b, 0);
    
    Object.entries(currentPoll.votes).forEach(([option, count]) => {
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
        resultsDiv.innerHTML += `
            <div class="mb-2">
                <div class="flex justify-between mb-1">
                    <span>${option}</span>
                    <span>${percentage}% (${count} votes)</span>
                </div>
                <div class="w-full bg-gray-200 rounded">
                    <div class="bg-green-500 rounded h-2" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    });
}

function updateNetworkStatus() {
    document.getElementById('peer-count').textContent = `Connected Peers: ${connections.size}`;
    document.getElementById('dht-status').textContent = 'DHT Status: Connected';
}

async function handleUrlHash() {
    const pollId = window.location.hash.substring(1);
    if (pollId) {
        currentPoll = await discovery.findPoll(pollId);
        if (currentPoll) {
            showVotingInterface();
            displayPoll();
        }
    }
}

// Initialize the application
initializeVoteMesh();

// Export necessary functions for external use
export {
    createPoll,
    submitVote,
    addOption,
    copyShareUrl
};