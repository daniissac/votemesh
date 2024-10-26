import { DHTNode } from './dht.js';
import { WebRTCConnection } from './webrtc.js';
import { PeerDiscovery } from './peer-discovery.js';

// Global state
const state = {
    discovery: null,
    connections: new Map(),
    currentPoll: null
};

// Core initialization
window.addEventListener('DOMContentLoaded', () => {
    initializeVoteMesh();
    setupEventListeners();
});

async function initializeVoteMesh() {
    const nodeId = generateNodeId();
    state.discovery = new PeerDiscovery();
    await state.discovery.joinNetwork(nodeId);
    handleUrlHash();
    updateNetworkStatus();
}

function generateNodeId() {
    return crypto.getRandomValues(new Uint8Array(32))[0];
}

function setupEventListeners() {
    // Network events
    state.discovery.on('peerDiscovered', handlePeerDiscovery);
    state.discovery.on('pollBroadcast', handlePollBroadcast);
    window.addEventListener('hashchange', handleUrlHash);
    
    // UI events with direct function assignments
    const createPollBtn = document.getElementById('create-poll-btn');
    if (createPollBtn) {
        createPollBtn.onclick = createPoll;
    }

    const addOptionBtn = document.getElementById('add-option-btn');
    if (addOptionBtn) {
        addOptionBtn.onclick = addOption;
    }

    const copyUrlBtn = document.getElementById('copy-url-btn');
    if (copyUrlBtn) {
        copyUrlBtn.onclick = copyShareUrl;
    }

    // Make functions globally available
    window.addOption = addOption;
    window.createPoll = createPoll;
    window.copyShareUrl = copyShareUrl;
}

// Network handlers
async function handlePeerDiscovery(peerId) {
    const connection = new WebRTCConnection(peerId);
    state.connections.set(peerId, connection);
    await connection.connect();
    updateNetworkStatus();
}

function handlePollBroadcast(peerId, poll) {
    if (!state.currentPoll || poll.id !== state.currentPoll.id) {
        state.currentPoll = poll;
        displayPoll();
    }
}

// Poll management
function createPoll() {
    const question = document.getElementById('question').value;
    const options = Array.from(document.getElementsByClassName('option-input'))
        .map(input => input.value.trim())
        .filter(Boolean);

    state.currentPoll = {
        id: crypto.randomUUID(),
        question,
        options,
        votes: Object.fromEntries(options.map(opt => [opt, 0])),
        timestamp: Date.now()
    };

    state.discovery.broadcastPoll(state.currentPoll);
    showVotingInterface();
}

function addOption() {
    const container = document.getElementById('options-container');
    const optionWrapper = document.createElement('div');
    optionWrapper.className = 'flex gap-2 mb-2';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'option-input w-full p-2 border rounded';
    input.placeholder = `Option ${container.children.length + 1}`;
    input.required = true;
    input.minLength = 1;
    input.maxLength = 100;
    
    const removeButton = document.createElement('button');
    removeButton.className = 'bg-red-500 text-white px-3 rounded hover:bg-red-600';
    removeButton.textContent = '×';
    removeButton.onclick = () => optionWrapper.remove();
    
    optionWrapper.appendChild(input);
    optionWrapper.appendChild(removeButton);
    container.appendChild(optionWrapper);
}

// UI management
function showVotingInterface() {
    document.getElementById('creator-section').classList.add('hidden');
    document.getElementById('voter-section').classList.remove('hidden');
    document.getElementById('share-section').classList.remove('hidden');
    
    const shareUrl = `${window.location.origin}/votemesh#${state.currentPoll.id}`;
    document.getElementById('share-url').value = shareUrl;
}

function displayPoll() {
    if (!state.currentPoll) return;
    
    document.getElementById('poll-question').textContent = state.currentPoll.question;
    const optionsContainer = document.getElementById('poll-options');
    optionsContainer.innerHTML = '';
    
    state.currentPoll.options.forEach(option => {
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
    
    const total = Object.values(state.currentPoll.votes).reduce((a, b) => a + b, 0);
    
    Object.entries(state.currentPoll.votes).forEach(([option, count]) => {
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

// Voting functionality
function submitVote(option) {
    state.currentPoll.votes[option]++;
    broadcastVote(option);
    displayResults();
}

function broadcastVote(option) {
    const voteData = {
        pollId: state.currentPoll.id,
        option
    };
    
    state.connections.forEach(connection => {
        connection.send(JSON.stringify({
            type: 'VOTE',
            data: voteData
        }));
    });
}

// Utility functions
function updateNetworkStatus() {
    document.getElementById('peer-count').textContent = `Connected Peers: ${state.connections.size}`;
    document.getElementById('dht-status').textContent = 'DHT Status: Connected';
}

function copyShareUrl() {
    const shareUrl = document.getElementById('share-url');
    shareUrl.select();
    document.execCommand('copy');
}

async function handleUrlHash() {
    const pollId = window.location.hash.substring(1);
    if (pollId) {
        state.currentPoll = await state.discovery.findPoll(pollId);
        if (state.currentPoll) {
            showVotingInterface();
            displayPoll();
        }
    }
}

export {
    createPoll,
    submitVote,
    addOption,
    copyShareUrl
};
