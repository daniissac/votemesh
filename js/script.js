// Core imports
import { WebRTCConnection } from './webrtc.js';
import { PeerDiscovery } from './peer-discovery.js';
import { createPoll, addOption, showPollInterface, copyShareUrl } from './poll.js';

// Global state management
const state = {
    discovery: null,
    connections: new Map(),
    currentPoll: null
};

// Core initialization
document.addEventListener('DOMContentLoaded', () => {
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
    
    // UI event bindings
    document.getElementById('create-poll-btn')?.addEventListener('click', () => createPoll());
    document.getElementById('add-option-btn')?.addEventListener('click', () => addOption());
    document.getElementById('copy-url-btn')?.addEventListener('click', () => copyShareUrl());
}

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

function updateNetworkStatus() {
    document.getElementById('peer-count').textContent = `Connected Peers: ${state.connections.size}`;
    document.getElementById('dht-status').textContent = 'DHT Status: Connected';
}

async function handleUrlHash() {
    const pollId = window.location.hash.substring(1);
    if (pollId) {
        state.currentPoll = await state.discovery.findPoll(pollId);
        if (state.currentPoll) {
            showPollInterface(state.currentPoll);
            displayPoll();
        }
    }
}

// Make functions globally available
window.addOption = addOption;
window.createPoll = createPoll;
window.copyShareUrl = copyShareUrl;

// Export necessary functions
export {
    createPoll,
    submitVote,
    addOption,
    copyShareUrl
};
