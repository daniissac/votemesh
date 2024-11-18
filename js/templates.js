// Poll Templates Manager
class TemplatesManager {
    constructor() {
        this.defaultTemplates = {
            'event-planning': {
                id: 'event-planning',
                name: 'Event Planning',
                question: 'When should we schedule our next event?',
                options: [
                    'Next Monday afternoon',
                    'Next Tuesday evening',
                    'Next Saturday morning',
                    'Next Sunday afternoon'
                ]
            },
            'team-decision': {
                id: 'team-decision',
                name: 'Team Decision',
                question: 'What should be our next project priority?',
                options: [
                    'Feature Development',
                    'Bug Fixes',
                    'Documentation',
                    'Testing'
                ]
            },
            'meeting-time': {
                id: 'meeting-time',
                name: 'Meeting Time',
                question: 'What time works best for our regular meetings?',
                options: [
                    '9:00 AM',
                    '2:00 PM',
                    '4:00 PM',
                    '5:00 PM'
                ]
            }
        };
        this.initializeTemplates();
    }

    async initializeTemplates() {
        // Load default templates if no templates exist
        const existingTemplates = await storageManager.getAllFromStore('templates');
        if (!existingTemplates || existingTemplates.length === 0) {
            for (const template of Object.values(this.defaultTemplates)) {
                await storageManager.saveTemplate(template);
            }
        }
    }

    async getAllTemplates() {
        return await storageManager.getAllFromStore('templates');
    }

    async getTemplate(id) {
        return await storageManager.getTemplate(id);
    }

    async saveTemplate(template) {
        if (!template.id) {
            template.id = 'custom-' + Date.now();
        }
        return await storageManager.saveTemplate(template);
    }

    async deleteTemplate(id) {
        // Don't allow deletion of default templates
        if (id in this.defaultTemplates) {
            return false;
        }
        return await storageManager.deleteFromStore('templates', id);
    }

    async createPollFromTemplate(templateId) {
        const template = await this.getTemplate(templateId);
        if (!template) return null;

        return {
            question: template.question,
            options: [...template.options], // Create a copy of the options
            createdAt: Date.now(),
            id: 'poll-' + Date.now()
        };
    }

    validateTemplate(template) {
        return (
            template &&
            typeof template.name === 'string' &&
            typeof template.question === 'string' &&
            Array.isArray(template.options) &&
            template.options.length >= 2 &&
            template.options.every(opt => typeof opt === 'string')
        );
    }
}

// Create and export a singleton instance
const templatesManager = new TemplatesManager();
window.templatesManager = templatesManager; // Make it globally available
