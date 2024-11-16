import { PeerDiscovery } from './peer-discovery.js';

export class PollManager {
    constructor(discovery) {
        this.discovery = discovery;
        this.polls = new Map();
        this.activeVoters = new Set();
        this.voteUpdateCallbacks = new Set();
        
        // Setup poll sync interval
        setInterval(() => this.syncPolls(), 30000);

        // Set up vote update listener
        this.discovery.on('peerMessage', (peerId, message) => {
            if (message.type === 'vote' && message.pollId) {
                this.handleVoteUpdate(message.pollId);
            }
        });
    }

    createPoll(question, options) {
        // Validate inputs
        if (!question || !options || !Array.isArray(options) || options.length < 2) {
            throw new Error('Invalid poll data: Question and at least 2 options are required');
        }

        const pollId = crypto.randomUUID();
        console.log('Creating new poll with ID:', pollId);
        
        const poll = {
            id: pollId,
            question: question.trim(),
            options: options.filter(opt => opt && opt.trim()), // Filter out empty options
            votes: {},
            timestamp: Date.now(),
            creator: this.discovery.dht.nodeId
        };

        // Initialize vote counts
        poll.options.forEach(opt => {
            poll.votes[opt] = 0;
        });

        console.log('Storing poll in local Map:', poll);
        this.polls.set(pollId, poll);
        
        console.log('Broadcasting poll to network');
        this.discovery.broadcastPoll(poll);
        return poll;
    }

    recordVote(pollId, option) {
        const poll = this.polls.get(pollId);
        if (!poll || !poll.votes.hasOwnProperty(option)) {
            console.warn('Invalid vote:', { pollId, option });
            return false;
        }

        poll.votes[option]++;
        this.discovery.broadcastVote(pollId, option);
        return true;
    }

    syncPolls() {
        // Request latest poll data from peers
        this.discovery.broadcast({
            type: 'SYNC_REQUEST',
            data: {
                polls: Array.from(this.polls.keys())
            }
        });
    }

    handlePollMessage(pollData) {
        console.log('Received poll message:', pollData);
        if (!this.polls.has(pollData.id)) {
            console.log('Storing new poll from network:', pollData.id);
            this.polls.set(pollData.id, pollData);
        }
    }

    handleVoteMessage(voteData) {
        const { pollId, option } = voteData;
        const poll = this.polls.get(pollId);
        if (poll && poll.votes.hasOwnProperty(option)) {
            poll.votes[option]++;
        }
    }

    handleSyncMessage(syncData) {
        if (!syncData || !syncData.polls) return;
        
        syncData.polls.forEach(poll => {
            const existingPoll = this.polls.get(poll.id);
            if (!existingPoll || existingPoll.timestamp < poll.timestamp) {
                this.polls.set(poll.id, poll);
            }
        });
    }

    getPoll(pollId) {
        console.log('Getting poll:', pollId);
        const poll = this.polls.get(pollId);
        console.log('Poll found:', poll);
        return poll;
    }

    getAllPolls() {
        return Array.from(this.polls.values());
    }

    registerVoteUpdateCallback(callback) {
        this.voteUpdateCallbacks.add(callback);
    }

    unregisterVoteUpdateCallback(callback) {
        this.voteUpdateCallbacks.delete(callback);
    }

    handleVoteUpdate(pollId) {
        const poll = this.polls.get(pollId);
        if (poll) {
            // Notify all registered callbacks
            this.voteUpdateCallbacks.forEach(callback => callback(poll));
        }
    }

    async refreshPoll(pollId) {
        try {
            // Try to get updated poll data from the network
            const updatedPoll = await this.discovery.findPoll(pollId);
            if (updatedPoll) {
                this.polls.set(pollId, updatedPoll);
                this.handleVoteUpdate(pollId);
            }
        } catch (error) {
            console.error('Error refreshing poll:', error);
        }
    }
}