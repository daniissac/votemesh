// Wait for storage initialization
let storageReady = false;
document.addEventListener('DOMContentLoaded', async () => {
    await storageManager.initializeIndexedDB();
    storageReady = true;
});

// P2P Connection Management
let peer = null;
let connections = new Set();
let localPolls = new Map();
let activePollId = null; // Track the active poll ID

// DOM Elements
const sections = {
    creator: document.getElementById('creator-section'),
    voter: document.getElementById('voter-section'),
    share: document.getElementById('share-section'),
    results: document.getElementById('results-section')
};

const elements = {
    pollForm: document.getElementById('poll-form'),
    pollOptions: document.getElementById('poll-vote-options'), 
    pollOptionsContainer: document.getElementById('poll-options'),
    addOptionBtn: document.getElementById('add-option-btn'),
    shareUrl: document.getElementById('share-url'),
    copyUrlBtn: document.getElementById('copy-url-btn'),
    submitVoteBtn: document.getElementById('submit-vote-btn'),
    networkStatus: {
        peerId: document.getElementById('peer-id'),
        peerCount: document.getElementById('peer-count'),
        indicator: document.getElementById('connection-indicator')
    }
};

// Initialize P2P Connection
function initializePeer() {
    const peerConfig = {
        debug: 2,
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                { urls: 'stun:stun3.l.google.com:19302' },
                { urls: 'stun:stun4.l.google.com:19302' }
            ]
        },
        // Increase reconnect attempts
        retries: 5
    };

    try {
        peer = new Peer(peerConfig);
        
        peer.on('open', id => {
            console.log('Connected with ID:', id);
            elements.networkStatus.peerId.textContent = `Your ID: ${id}`;
            elements.networkStatus.indicator.classList.add('connected');
            elements.networkStatus.indicator.classList.remove('error');
            loadPollFromUrl();
        });

        peer.on('connection', handleIncomingConnection);
        
        peer.on('error', error => {
            console.error('Peer connection error:', error);
            elements.networkStatus.indicator.classList.remove('connected');
            elements.networkStatus.indicator.classList.add('error');
            
            // Attempt to reconnect after a delay
            setTimeout(() => {
                if (!peer.disconnected) return;
                console.log('Attempting to reconnect...');
                peer.reconnect();
            }, 5000);
        });

        peer.on('disconnected', () => {
            console.log('Disconnected from server. Attempting to reconnect...');
            elements.networkStatus.indicator.classList.remove('connected');
            elements.networkStatus.peerId.textContent = 'Reconnecting...';
            
            // Attempt to reconnect
            setTimeout(() => {
                if (!peer.destroyed) {
                    peer.reconnect();
                }
            }, 5000);
        });
    } catch (error) {
        console.error('Failed to initialize peer:', error);
        elements.networkStatus.indicator.classList.add('error');
        elements.networkStatus.peerId.textContent = 'Connection failed';
    }
}

// Connection Handling
function handleIncomingConnection(conn) {
    connections.add(conn);
    updatePeerCount();
    
    conn.on('data', data => handleIncomingData(conn, data));
    conn.on('close', () => {
        connections.delete(conn);
        updatePeerCount();
    });
}

function connectToPeer(peerId) {
    if (peerId === peer.id) return; // Don't connect to self
    
    const conn = peer.connect(peerId);
    
    conn.on('open', () => {
        connections.add(conn);
        updatePeerCount();
        activePollId = peerId; // Set active poll to creator's ID
        
        // Request poll data if we're joining as a voter
        conn.send({ type: 'request_poll' });
    });
    
    conn.on('data', data => handleIncomingData(conn, data));
    conn.on('close', () => {
        connections.delete(conn);
        updatePeerCount();
    });
}

function updatePeerCount() {
    elements.networkStatus.peerCount.textContent = `Connected Peers: ${connections.size}`;
}

// Data Handling
function handleIncomingData(conn, data) {
    console.log('Received data:', data);
    
    switch (data.type) {
        case 'request_poll':
            console.log('Poll requested, checking local polls...');
            if (peer && peer.id && localPolls.has(peer.id)) {
                console.log('Sending poll:', localPolls.get(peer.id));
                conn.send({
                    type: 'poll_data',
                    poll: localPolls.get(peer.id)
                });
            } else {
                console.log('No poll found to send');
                conn.send({
                    type: 'error',
                    message: 'No active poll found'
                });
            }
            break;
            
        case 'poll_data':
            console.log('Received poll data:', data.poll);
            if (data.poll && data.poll.id) {
                localPolls.set(data.poll.id, data.poll);
                activePollId = data.poll.id;
                displayPoll(data.poll);
            }
            break;
            
        case 'vote':
            console.log('Received vote:', data);
            if (data.option !== undefined) {
                handleVote(data.option);
                broadcastToOtherPeers(conn, data);
            }
            break;
            
        case 'error':
            console.error('Received error:', data.message);
            // Handle error appropriately
            break;
    }
}

function broadcastToOtherPeers(sourceConn, data) {
    for (const conn of connections) {
        if (conn !== sourceConn) {
            conn.send(data);
        }
    }
}

// Enhanced Poll Creation
async function createPoll(question, options, settings = {}) {
    const poll = {
        id: peer.id,
        question,
        options,
        settings: {
            multipleChoice: settings.multipleChoice || false,
            hideResults: settings.hideResults || false
        },
        votes: {},
        createdAt: Date.now()
    };
    
    await storageManager.savePoll(poll);
    localPolls.set(poll.id, poll);
    activePollId = poll.id;
    
    // Broadcast to peers
    broadcastToOtherPeers(null, {
        type: 'poll_data',
        poll
    });
    
    displayPoll(poll);
    updateShareUrl();
    
    // Initialize analytics
    analyticsManager.trackVote(poll.id, null, poll.createdAt);
}

// Poll Display
function displayPoll(poll) {
    if (!poll) {
        console.error('No poll data to display');
        return;
    }

    try {
        // Hide creator section and show voter/share sections
        sections.creator.classList.add('hidden');
        sections.voter.classList.remove('hidden');
        sections.share.classList.remove('hidden');
        
        // Update question
        const questionElement = document.getElementById('poll-question');
        if (questionElement) {
            questionElement.textContent = poll.question;
        }
        
        // Display options and results
        displayPollOptions(poll);
        displayResults(poll);
        
        // Update share URL
        updateShareUrl();
    } catch (error) {
        console.error('Error displaying poll:', error);
    }
}

function displayPollOptions(poll) {
    if (!elements.pollOptions) {
        console.error('Poll options container not found');
        return;
    }

    try {
        elements.pollOptions.innerHTML = '';
        
        poll.options.forEach((option, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'option-group';
            
            const button = document.createElement('button');
            button.className = 'button secondary full-width';
            button.innerHTML = `<i data-feather="circle"></i> ${option}`;
            button.onclick = () => submitVote(index);
            
            optionDiv.appendChild(button);
            elements.pollOptions.appendChild(optionDiv);
        });
        
        // Re-initialize Feather icons for the new buttons
        if (window.feather) {
            feather.replace();
        }
    } catch (error) {
        console.error('Error displaying poll options:', error);
    }
}

function displayResults(poll) {
    const resultsDiv = document.getElementById('results');
    if (!poll || !resultsDiv) return;

    const totalVotes = Object.values(poll.votes).flat().length;
    const voteCounts = {};
    
    // Count votes for each option
    Object.values(poll.votes).flat().forEach(vote => {
        voteCounts[vote] = (voteCounts[vote] || 0) + 1;
    });
    
    // Display results
    resultsDiv.innerHTML = poll.options.map((option, index) => {
        const count = voteCounts[index] || 0;
        const percentage = totalVotes ? (count / totalVotes * 100).toFixed(1) : 0;
        
        return `
            <div class="result-item">
                <div class="result-label">
                    <span>${option}</span>
                    <span>${count} votes (${percentage}%)</span>
                </div>
                <div class="result-bar" style="width: ${percentage}%"></div>
            </div>
        `;
    }).join('');
    
    // Update analytics charts
    analyticsManager.renderVoteDistribution(poll.id, 'vote-distribution-chart');
    analyticsManager.renderVotingTrend(poll.id, 'voting-trend-chart');
}

// Vote Handling
function submitVote(optionIndex) {
    const poll = localPolls.get(activePollId);
    if (!poll) {
        console.error('No active poll found'); // Debug log
        return;
    }
    
    handleVote(optionIndex);
    
    // Broadcast vote to all peers
    for (const conn of connections) {
        conn.send({
            type: 'vote',
            option: optionIndex
        });
    }
}

function handleVote(optionIndex) {
    const poll = localPolls.get(activePollId);
    if (!poll || !poll.options[optionIndex]) {
        console.error('Invalid poll or option index:', { activePollId, optionIndex, poll }); // Debug log
        return;
    }
    
    if (!poll.votes[peer.id]) {
        poll.votes[peer.id] = [];
    }
    
    poll.votes[peer.id].push(optionIndex);
    displayResults(poll);
}

// URL Handling
function updateShareUrl() {
    const shareUrlInput = elements.shareUrl;
    const shareSection = sections.share;
    
    if (!shareUrlInput || !shareSection) {
        console.error('Share URL elements not found');
        return;
    }

    try {
        const url = new URL(window.location.href);
        url.searchParams.set('peer', peer.id);
        shareUrlInput.value = url.toString();
        shareSection.classList.remove('hidden');
    } catch (error) {
        console.error('Failed to update share URL:', error);
    }
}

function loadPollFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const peerId = urlParams.get('peer');
    
    if (peerId && peerId !== peer.id) {
        connectToPeer(peerId);
    }
}

// Template Integration
function initializeTemplates() {
    const templatesList = document.getElementById('templates-list');
    const createTemplateBtn = document.getElementById('create-template-btn');
    
    createTemplateBtn.addEventListener('click', () => {
        // Show template creation modal
        showTemplateModal();
    });
    
    // Load and display templates
    refreshTemplatesList();
}

async function refreshTemplatesList() {
    const templatesList = document.getElementById('templates-list');
    const templates = await templatesManager.getAllTemplates();
    
    templatesList.innerHTML = templates.map(template => `
        <div class="template-card" data-template-id="${template.id}">
            <h3>${template.name}</h3>
            <p>${template.question}</p>
        </div>
    `).join('');
    
    // Add click handlers
    templatesList.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', () => useTemplate(card.dataset.templateId));
    });
}

async function useTemplate(templateId) {
    const poll = await templatesManager.createPollFromTemplate(templateId);
    if (poll) {
        document.getElementById('question').value = poll.question;
        updatePollOptions(poll.options);
    }
}

// Initialize the application
async function initializeApp() {
    try {
        console.log('Initializing application...');
        
        // First, initialize the database
        await storageManager.initializeIndexedDB();
        console.log('Database initialized');
        
        // Initialize peer connection
        initializePeer();
        console.log('Peer initialized');
        
        // Initialize templates
        await initializeTemplates();
        console.log('Templates initialized');
        
        // Setup event listeners
        setupEventListeners();
        console.log('Event listeners set up');
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        // Show error to user
        elements.networkStatus.peerId.textContent = 'Failed to initialize application';
        elements.networkStatus.indicator.classList.add('error');
    }
}

// Event Listener Setup
function setupEventListeners() {
    if (!peer) {
        console.error('Peer not initialized');
        return;
    }

    // Network status updates
    peer.on('connection', () => {
        elements.networkStatus.indicator.classList.add('connected');
    });

    peer.on('disconnected', () => {
        elements.networkStatus.indicator.classList.remove('connected');
    });

    // Template management
    const templatesList = document.getElementById('templates-list');
    const createTemplateBtn = document.getElementById('create-template-btn');
    
    if (createTemplateBtn) {
        createTemplateBtn.addEventListener('click', () => {
            showTemplateModal();
        });
    }

    if (templatesList) {
        templatesList.addEventListener('click', (e) => {
            const templateCard = e.target.closest('.template-card');
            if (templateCard) {
                useTemplate(templateCard.dataset.templateId);
            }
        });
    }

    // Poll form submission
    elements.pollForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const question = document.getElementById('question').value;
        const options = Array.from(document.getElementsByName('option[]'))
            .map(input => input.value.trim())
            .filter(value => value);
        
        if (question && options.length >= 2) {
            await createPoll(question, options);
        }
    });

    // Add option button
    elements.addOptionBtn.addEventListener('click', () => {
        const optionsDiv = document.getElementById('poll-options');
        const currentOptions = optionsDiv.querySelectorAll('.option-input-group').length;
        addOption(currentOptions + 1);
    });

    // Copy URL button
    elements.copyUrlBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(elements.shareUrl.value);
            elements.copyUrlBtn.textContent = 'Copied!';
            setTimeout(() => {
                elements.copyUrlBtn.textContent = 'Copy URL';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
        }
    });

    // Export buttons
    document.getElementById('export-results-btn')?.addEventListener('click', async () => {
        if (!activePollId) return;
        
        const poll = localPolls.get(activePollId);
        if (!poll) return;
        
        const data = {
            question: poll.question,
            options: poll.options,
            votes: poll.votes,
            createdAt: poll.createdAt
        };
        
        downloadJson(data, `poll-results-${activePollId}.json`);
    });

    document.getElementById('export-analytics-btn')?.addEventListener('click', async () => {
        if (!activePollId) return;
        
        const analytics = await analyticsManager.exportAnalytics(activePollId);
        if (!analytics) return;
        
        downloadJson(analytics, `poll-analytics-${activePollId}.json`);
    });
}

// Template Modal Functions
function showTemplateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2><i data-feather="file-plus"></i> Create Template</h2>
            <form id="template-form">
                <div class="form-group">
                    <label for="template-name">Template Name</label>
                    <input type="text" id="template-name" required>
                </div>
                <div class="form-group">
                    <label for="template-question">Question</label>
                    <input type="text" id="template-question" required>
                </div>
                <div class="form-group">
                    <label>Options</label>
                    <div id="template-options">
                        <input type="text" name="template-option[]" required>
                        <input type="text" name="template-option[]" required>
                    </div>
                    <button type="button" id="add-template-option">Add Option</button>
                </div>
                <div class="modal-actions">
                    <button type="button" class="button secondary" onclick="closeTemplateModal()">Cancel</button>
                    <button type="submit" class="button primary">Save Template</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    feather.replace();

    // Add event listeners
    const form = modal.querySelector('#template-form');
    const addOptionBtn = modal.querySelector('#add-template-option');

    addOptionBtn.addEventListener('click', () => {
        const optionsContainer = modal.querySelector('#template-options');
        const input = document.createElement('input');
        input.type = 'text';
        input.name = 'template-option[]';
        input.required = true;
        optionsContainer.appendChild(input);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const template = {
            id: Date.now().toString(),
            name: modal.querySelector('#template-name').value,
            question: modal.querySelector('#template-question').value,
            options: Array.from(modal.querySelectorAll('[name="template-option[]"]'))
                .map(input => input.value.trim())
                .filter(Boolean)
        };

        await templatesManager.saveTemplate(template);
        closeTemplateModal();
        refreshTemplatesList();
    });
}

function closeTemplateModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded');
    initializeApp().catch(error => {
        console.error('Failed to initialize application:', error);
    });
});

// Add two default options
document.addEventListener('DOMContentLoaded', () => {
    for (let i = 1; i <= 2; i++) {
        addOption(i);
    }
});

function addOption(number) {
    if (!elements.pollOptionsContainer) {
        console.error('Poll options container not found');
        return;
    }

    const optionGroup = document.createElement('div');
    optionGroup.className = 'option-input-group';
    optionGroup.innerHTML = `
        <input type="text"
               name="option[]"
               class="form-input"
               placeholder="Option ${number}"
               required>
    `;
    elements.pollOptionsContainer.appendChild(optionGroup);
}
