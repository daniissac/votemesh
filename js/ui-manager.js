export class UIManager {
    constructor(pollManager) {
        this.pollManager = pollManager;
        this.currentPollId = null;
        this.refreshInterval = null;
        this.setupEventListeners();
        
        // Register for vote updates
        this.pollManager.registerVoteUpdateCallback((poll) => {
            if (poll.id === this.currentPollId) {
                this.updateResults(poll);
            }
        });
    }

    setupEventListeners() {
        // Copy share URL button
        const copyUrlBtn = document.getElementById('copy-url-btn');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => this.copyShareUrl());
        }
    }

    displayPoll(poll) {
        this.currentPollId = poll.id;
        document.getElementById('creator-section').classList.add('hidden');
        document.getElementById('voter-section').classList.remove('hidden');
        
        document.getElementById('poll-question').textContent = poll.question;
        
        const optionsContainer = document.getElementById('poll-options');
        optionsContainer.innerHTML = '';
        
        poll.options.forEach(option => {
            const button = document.createElement('button');
            button.className = 'w-full p-3 bg-gray-100 hover:bg-gray-200 rounded text-left mb-2';
            button.textContent = option;
            button.onclick = () => this.handleVote(poll.id, option);
            optionsContainer.appendChild(button);
        });

        this.updateResults(poll);
        
        // Start auto-refresh
        this.startAutoRefresh();
    }

    handleVote(pollId, option) {
        if (this.pollManager.recordVote(pollId, option)) {
            const poll = this.pollManager.polls.get(pollId);
            this.updateResults(poll);
        }
    }

    updateResults(poll) {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = '';
        
        const total = Object.values(poll.votes).reduce((a, b) => a + b, 0);
        
        Object.entries(poll.votes).forEach(([option, count]) => {
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

    showShareSection(pollId) {
        const shareSection = document.getElementById('share-section');
        shareSection.classList.remove('hidden');
        
        const baseUrl = 'https://daniissac.com/votemesh/';
        const shareUrl = `${baseUrl}#${pollId}`;
        document.getElementById('share-url').value = shareUrl;
    }

    copyShareUrl() {
        const shareUrl = document.getElementById('share-url');
        shareUrl.select();
        document.execCommand('copy');
        alert('Share URL copied!');
    }

    updateNetworkStatus(peerCount, status) {
        document.getElementById('peer-count').textContent = `Connected Peers: ${peerCount}`;
        document.getElementById('dht-status').textContent = `DHT Status: ${status}`;
    }

    startAutoRefresh() {
        // Clear any existing refresh interval
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Set up new refresh interval (every 5 seconds)
        this.refreshInterval = setInterval(() => {
            if (this.currentPollId) {
                this.pollManager.refreshPoll(this.currentPollId);
            }
        }, 5000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }
}