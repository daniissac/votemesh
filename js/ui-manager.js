export class UIManager {
    constructor(pollManager) {
        this.pollManager = pollManager;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Copy share URL button
        const copyUrlBtn = document.getElementById('copy-url-btn');
        if (copyUrlBtn) {
            copyUrlBtn.addEventListener('click', () => this.copyShareUrl());
        }
    }

    handlePollCreation() {
        const question = document.getElementById('question').value;
        const options = Array.from(document.getElementsByClassName('option-input'))
            .map(input => input.value.trim())
            .filter(Boolean);

        if (question && options.length >= 2) {
            const poll = this.pollManager.createPoll(question, options);
            this.displayPoll(poll);
            this.showShareSection(poll.id);
        }
    }

    addOption() {
        const container = document.getElementById('options-container');
        const optionWrapper = document.createElement('div');
        optionWrapper.className = 'flex gap-2 mb-2';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'option-input w-full p-2 border rounded';
        input.placeholder = `Option ${container.children.length + 1}`;
        input.required = true;
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'bg-red-500 text-white px-3 rounded hover:bg-red-600';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => optionWrapper.remove();
        
        optionWrapper.appendChild(input);
        optionWrapper.appendChild(removeBtn);
        container.appendChild(optionWrapper);
    }

    displayPoll(poll) {
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
        
        // Get the base URL of the website
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
} 