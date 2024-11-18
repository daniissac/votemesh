// Analytics Manager for VoteMesh
class AnalyticsManager {
    constructor() {
        this.charts = new Map();
    }

    async trackVote(pollId, optionIndex, timestamp = Date.now()) {
        const analytics = await this.getPollAnalytics(pollId) || {
            pollId,
            votes: [],
            votingPattern: {},
            responseTime: []
        };

        analytics.votes.push({
            optionIndex,
            timestamp
        });

        // Update voting pattern
        analytics.votingPattern[optionIndex] = (analytics.votingPattern[optionIndex] || 0) + 1;

        // Calculate response time if there are previous votes
        if (analytics.votes.length > 1) {
            const lastVote = analytics.votes[analytics.votes.length - 2];
            const timeDiff = timestamp - lastVote.timestamp;
            analytics.responseTime.push(timeDiff);
        }

        await storageManager.saveAnalytics(analytics);
        return analytics;
    }

    async getPollAnalytics(pollId) {
        return await storageManager.getAnalytics(pollId);
    }

    async getVotingTrends(pollId) {
        const analytics = await this.getPollAnalytics(pollId);
        if (!analytics) return null;

        const timeIntervals = this.groupVotesByTimeInterval(analytics.votes);
        return {
            totalVotes: analytics.votes.length,
            votingPattern: analytics.votingPattern,
            timeIntervals,
            averageResponseTime: this.calculateAverageResponseTime(analytics.responseTime)
        };
    }

    groupVotesByTimeInterval(votes, intervalMinutes = 5) {
        const intervals = {};
        const intervalMs = intervalMinutes * 60 * 1000;

        votes.forEach(vote => {
            const intervalKey = Math.floor(vote.timestamp / intervalMs) * intervalMs;
            intervals[intervalKey] = (intervals[intervalKey] || 0) + 1;
        });

        return intervals;
    }

    calculateAverageResponseTime(responseTimes) {
        if (!responseTimes || responseTimes.length === 0) return 0;
        const sum = responseTimes.reduce((a, b) => a + b, 0);
        return sum / responseTimes.length;
    }

    // Chart rendering methods
    renderVoteDistribution(pollId, containerId) {
        this.getPollAnalytics(pollId).then(analytics => {
            if (!analytics) return;

            const ctx = document.getElementById(containerId).getContext('2d');
            const data = {
                labels: Object.keys(analytics.votingPattern),
                datasets: [{
                    label: 'Votes per Option',
                    data: Object.values(analytics.votingPattern),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.5)',
                        'rgba(54, 162, 235, 0.5)',
                        'rgba(255, 206, 86, 0.5)',
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(153, 102, 255, 0.5)'
                    ]
                }]
            };

            if (this.charts.has(containerId)) {
                this.charts.get(containerId).destroy();
            }

            this.charts.set(containerId, new Chart(ctx, {
                type: 'bar',
                data: data,
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Vote Distribution'
                        }
                    }
                }
            }));
        });
    }

    renderVotingTrend(pollId, containerId) {
        this.getVotingTrends(pollId).then(trends => {
            if (!trends) return;

            const ctx = document.getElementById(containerId).getContext('2d');
            const timestamps = Object.keys(trends.timeIntervals).map(t => new Date(parseInt(t)));
            const votes = Object.values(trends.timeIntervals);

            const data = {
                labels: timestamps,
                datasets: [{
                    label: 'Votes over Time',
                    data: votes,
                    fill: false,
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }]
            };

            if (this.charts.has(containerId)) {
                this.charts.get(containerId).destroy();
            }

            this.charts.set(containerId, new Chart(ctx, {
                type: 'line',
                data: data,
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'top',
                        },
                        title: {
                            display: true,
                            text: 'Voting Trend'
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute'
                            }
                        }
                    }
                }
            }));
        });
    }

    // Export analytics data
    async exportAnalytics(pollId) {
        const analytics = await this.getPollAnalytics(pollId);
        if (!analytics) return null;

        const trends = await this.getVotingTrends(pollId);
        return {
            pollId,
            totalVotes: trends.totalVotes,
            votingPattern: trends.votingPattern,
            timeIntervals: trends.timeIntervals,
            averageResponseTime: trends.averageResponseTime,
            rawData: analytics
        };
    }
}

// Create and export a singleton instance
const analyticsManager = new AnalyticsManager();
window.analyticsManager = analyticsManager; // Make it globally available
