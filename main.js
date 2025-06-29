// Journify Frontend Script (main.js)

class JournifyApp {
    constructor() {
        // Initialize app state
        this.currentDate = new Date();
        this.currentTheme = 'light';
        this.currentMoodTheme = 'calm';
        this.journalEntries = [];
        this.isRecording = false;
        this.recognition = null;
        
        // API Configuration
        this.API_BASE = '/api'; // Adjust based on your backend
        this.QUOTES_API = 'https://zenquotes.io/api/today';
        
        // Initialize the app
        this.init();
    }

    async init() {
        try {
            // Load saved theme and data
            this.loadTheme();
            this.initializeEventListeners();
            await this.loadJournalEntries();
            this.renderCalendar();
            this.updateStreakDisplay();
            this.updateWeeklySummary();
            await this.loadDailyQuote();
            this.initializeVoiceRecognition();
            this.renderAnalytics();
            
            this.showToast('Welcome to Journify!', 'info');
        } catch (error) {
            console.error('Error initializing app:', error);
            this.showToast('Error loading app data', 'error');
        }
    }

    // ===== THEME MANAGEMENT =====
    loadTheme() {
        const savedTheme = localStorage.getItem('journify-theme') || 'light';
        const savedMoodTheme = localStorage.getItem('journify-mood-theme') || 'calm';
        
        this.currentTheme = savedTheme;
        this.currentMoodTheme = savedMoodTheme;
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        document.body.className = `theme-${savedMoodTheme}`;
        
        // Update theme toggle icon
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = savedTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.currentTheme);
        localStorage.setItem('journify-theme', this.currentTheme);
        
        // Update icon
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = this.currentTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        
        this.showToast(`Switched to ${this.currentTheme} mode`, 'info');
    }

    applyMoodTheme(mood) {
        const moodThemes = {
            'amazing': 'joy',
            'good': 'peaceful',
            'okay': 'calm',
            'bad': 'sad',
            'terrible': 'angry'
        };
        
        const theme = moodThemes[mood] || 'calm';
        this.currentMoodTheme = theme;
        
        document.body.className = `theme-${theme}`;
        localStorage.setItem('journify-mood-theme', theme);
        
        // Add subtle animation
        document.body.style.transition = 'background 0.5s ease';
    }

    // ===== EVENT LISTENERS =====
    initializeEventListeners() {
        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Journal form submission
        const journalForm = document.getElementById('journalForm');
        if (journalForm) {
            journalForm.addEventListener('submit', (e) => this.handleJournalSubmit(e));
        }

        // Mood selection change
        const moodSelect = document.getElementById('moodSelect');
        if (moodSelect) {
            moodSelect.addEventListener('change', (e) => this.applyMoodTheme(e.target.value));
        }

        // Calendar navigation
        const prevMonth = document.getElementById('prevMonth');
        const nextMonth = document.getElementById('nextMonth');
        if (prevMonth) prevMonth.addEventListener('click', () => this.navigateMonth(-1));
        if (nextMonth) nextMonth.addEventListener('click', () => this.navigateMonth(1));

        // Voice input
        const voiceBtn = document.getElementById('voiceBtn');
        if (voiceBtn) {
            voiceBtn.addEventListener('click', () => this.showVoiceModal());
        }

        // Sentiment analysis
        const analyzeBtn = document.getElementById('analyzeBtn');
        if (analyzeBtn) {
            analyzeBtn.addEventListener('click', () => this.performSentimentAnalysis());
        }

        // PDF export
        const exportBtn = document.getElementById('exportPDF');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportToPDF());
        }

        // Modal controls
        this.initializeModalListeners();

        // Analytics timeframe
        const analyticsTimeframe = document.getElementById('analyticsTimeframe');
        if (analyticsTimeframe) {
            analyticsTimeframe.addEventListener('change', () => this.renderAnalytics());
        }
    }

    initializeModalListeners() {
        const voiceModal = document.getElementById('voiceModal');
        const closeModal = document.getElementById('closeModal');
        const startRecording = document.getElementById('startRecording');
        const stopRecording = document.getElementById('stopRecording');

        if (closeModal) {
            closeModal.addEventListener('click', () => this.hideVoiceModal());
        }

        if (voiceModal) {
            voiceModal.addEventListener('click', (e) => {
                if (e.target === voiceModal) this.hideVoiceModal();
            });
        }

        if (startRecording) {
            startRecording.addEventListener('click', () => this.startVoiceRecording());
        }

        if (stopRecording) {
            stopRecording.addEventListener('click', () => this.stopVoiceRecording());
        }
    }

    // ===== JOURNAL ENTRY MANAGEMENT =====
    async handleJournalSubmit(e) {
        e.preventDefault();
        
        const formData = {
            date: new Date().toISOString().split('T')[0],
            wentWell: document.getElementById('wentWell').value,
            couldImprove: document.getElementById('couldImprove').value,
            tomorrowGoal: document.getElementById('tomorrowGoal').value,
            mood: document.getElementById('moodSelect').value,
            moodNote: document.getElementById('moodNote').value,
            timestamp: new Date().toISOString()
        };

        if (!formData.mood) {
            this.showToast('Please select a mood', 'error');
            return;
        }

        try {
            this.showLoading(true);
            await this.saveJournalEntry(formData);
            this.clearForm();
            this.renderCalendar();
            this.updateStreakDisplay();
            this.updateWeeklySummary();
            this.renderAnalytics();
            this.showToast('Journal entry saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving journal entry:', error);
            this.showToast('Error saving journal entry', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async saveJournalEntry(entry) {
        try {
            // Save to backend API
            const response = await fetch(`${this.API_BASE}/journal`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry)
            });

            if (!response.ok) {
                throw new Error('Failed to save entry');
            }

            // Also save locally as backup
            const existingEntries = JSON.parse(localStorage.getItem('journify-entries') || '[]');
            const entryIndex = existingEntries.findIndex(e => e.date === entry.date);
            
            if (entryIndex >= 0) {
                existingEntries[entryIndex] = entry;
            } else {
                existingEntries.push(entry);
            }
            
            localStorage.setItem('journify-entries', JSON.stringify(existingEntries));
            this.journalEntries = existingEntries;
            
            return await response.json();
        } catch (error) {
            // Fallback to local storage if API fails
            console.warn('API unavailable, saving locally:', error);
            
            const existingEntries = JSON.parse(localStorage.getItem('journify-entries') || '[]');
            const entryIndex = existingEntries.findIndex(e => e.date === entry.date);
            
            if (entryIndex >= 0) {
                existingEntries[entryIndex] = entry;
            } else {
                existingEntries.push(entry);
            }
            
            localStorage.setItem('journify-entries', JSON.stringify(existingEntries));
            this.journalEntries = existingEntries;
            
            return entry;
        }
    }

    async loadJournalEntries() {
        try {
            // Try to load from API first
            const response = await fetch(`${this.API_BASE}/journal`);
            if (response.ok) {
                this.journalEntries = await response.json();
                // Sync with local storage
                localStorage.setItem('journify-entries', JSON.stringify(this.journalEntries));
            } else {
                throw new Error('API unavailable');
            }
        } catch (error) {
            // Fallback to local storage
            console.warn('Loading from local storage:', error);
            this.journalEntries = JSON.parse(localStorage.getItem('journify-entries') || '[]');
        }
    }

    clearForm() {
        document.getElementById('wentWell').value = '';
        document.getElementById('couldImprove').value = '';
        document.getElementById('tomorrowGoal').value = '';
        document.getElementById('moodSelect').value = '';
        document.getElementById('moodNote').value = '';
    }

    // ===== CALENDAR FUNCTIONALITY =====
    renderCalendar() {
        const calendarGrid = document.getElementById('calendarGrid');
        const currentMonthElement = document.getElementById('currentMonth');
        
        if (!calendarGrid || !currentMonthElement) return;

        // Update month display
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                           'July', 'August', 'September', 'October', 'November', 'December'];
        currentMonthElement.textContent = `${monthNames[this.currentDate.getMonth()]} ${this.currentDate.getFullYear()}`;

        // Clear calendar
        calendarGrid.innerHTML = '';

        // Add day headers
        const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayHeaders.forEach(day => {
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day header';
            dayElement.textContent = day;
            calendarGrid.appendChild(dayElement);
        });

        // Get first day of month and number of days
        const firstDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
        const lastDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        // Generate calendar days
        for (let i = 0; i < 42; i++) {
            const currentDay = new Date(startDate);
            currentDay.setDate(startDate.getDate() + i);
            
            const dayElement = document.createElement('div');
            dayElement.className = 'calendar-day';
            dayElement.textContent = currentDay.getDate();
            
            // Add classes for styling
            if (currentDay.getMonth() !== this.currentDate.getMonth()) {
                dayElement.classList.add('other-month');
            }
            
            if (this.isToday(currentDay)) {
                dayElement.classList.add('today');
            }
            
            // Add mood indicator
            const entry = this.getEntryForDate(currentDay);
            if (entry && entry.mood) {
                dayElement.classList.add(`mood-${entry.mood}`);
                dayElement.title = `Mood: ${entry.mood}${entry.moodNote ? ` - ${entry.moodNote}` : ''}`;
            }
            
            // Add click listener
            dayElement.addEventListener('click', () => this.showDayDetails(currentDay));
            
            calendarGrid.appendChild(dayElement);
        }
    }

    navigateMonth(direction) {
        this.currentDate.setMonth(this.currentDate.getMonth() + direction);
        this.renderCalendar();
    }

    isToday(date) {
        const today = new Date();
        return date.toDateString() === today.toDateString();
    }

    getEntryForDate(date) {
        const dateString = date.toISOString().split('T')[0];
        return this.journalEntries.find(entry => entry.date === dateString);
    }

    showDayDetails(date) {
        const entry = this.getEntryForDate(date);
        if (entry) {
            // Show entry details in a modal or sidebar
            this.showToast(`${date.toDateString()}: ${entry.mood} mood`, 'info');
        }
    }

    // ===== STREAK TRACKING =====
    updateStreakDisplay() {
        const streak = this.calculateCurrentStreak();
        const longestStreak = this.calculateLongestStreak();
        const totalEntries = this.journalEntries.length;

        // Update UI elements
        const streakCountElement = document.getElementById('streakCount');
        const totalEntriesElement = document.getElementById('totalEntries');
        const longestStreakElement = document.getElementById('longestStreak');

        if (streakCountElement) streakCountElement.textContent = streak;
        if (totalEntriesElement) totalEntriesElement.textContent = totalEntries;
        if (longestStreakElement) longestStreakElement.textContent = longestStreak;
    }

    calculateCurrentStreak() {
        if (this.journalEntries.length === 0) return 0;

        // Sort entries by date (newest first)
        const sortedEntries = [...this.journalEntries].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let streak = 0;
        const today = new Date();
        let currentDate = new Date(today);

        // Check if there's an entry for today or yesterday
        const todayString = today.toISOString().split('T')[0];
        const yesterdayString = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        if (!sortedEntries.some(entry => entry.date === todayString || entry.date === yesterdayString)) {
            return 0;
        }

        // Calculate streak
        for (let i = 0; i < sortedEntries.length; i++) {
            const entryDate = new Date(sortedEntries[i].date);
            const daysDiff = Math.floor((currentDate - entryDate) / (24 * 60 * 60 * 1000));
            
            if (daysDiff === streak) {
                streak++;
                currentDate.setDate(currentDate.getDate() - 1);
            } else {
                break;
            }
        }

        return streak;
    }

    calculateLongestStreak() {
        if (this.journalEntries.length === 0) return 0;

        const sortedEntries = [...this.journalEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
        let longestStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < sortedEntries.length; i++) {
            const currentDate = new Date(sortedEntries[i].date);
            const previousDate = new Date(sortedEntries[i - 1].date);
            const daysDiff = Math.floor((currentDate - previousDate) / (24 * 60 * 60 * 1000));

            if (daysDiff === 1) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }

        return longestStreak;
    }

    // ===== SENTIMENT ANALYSIS =====
    async performSentimentAnalysis() {
        const wentWell = document.getElementById('wentWell').value;
        const couldImprove = document.getElementById('couldImprove').value;
        const tomorrowGoal = document.getElementById('tomorrowGoal').value;

        if (!wentWell && !couldImprove && !tomorrowGoal) {
            this.showToast('Please write something to analyze', 'error');
            return;
        }

        const text = `${wentWell} ${couldImprove} ${tomorrowGoal}`.trim();

        try {
            this.showLoading(true);
            
            // Try backend API first
            let sentimentData;
            try {
                const response = await fetch(`${this.API_BASE}/sentiment`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text })
                });

                if (response.ok) {
                    sentimentData = await response.json();
                } else {
                    throw new Error('API unavailable');
                }
            } catch (apiError) {
                // Fallback to simple client-side analysis
                sentimentData = this.performSimpleSentimentAnalysis(text);
            }

            this.displaySentimentResults(sentimentData);
            
        } catch (error) {
            console.error('Error performing sentiment analysis:', error);
            this.showToast('Error analyzing sentiment', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    performSimpleSentimentAnalysis(text) {
        const positiveWords = ['good', 'great', 'excellent', 'happy', 'wonderful', 'amazing', 'perfect', 'love', 'joy', 'excited', 'grateful', 'blessed', 'fantastic', 'awesome'];
        const negativeWords = ['bad', 'terrible', 'awful', 'sad', 'angry', 'frustrated', 'disappointed', 'stressed', 'worried', 'anxious', 'hate', 'horrible', 'worst'];
        
        const words = text.toLowerCase().split(/\W+/);
        let positiveCount = 0;
        let negativeCount = 0;
        
        words.forEach(word => {
            if (positiveWords.includes(word)) positiveCount++;
            if (negativeWords.includes(word)) negativeCount++;
        });
        
        const totalEmotionalWords = positiveCount + negativeCount;
        let sentiment = 'neutral';
        let confidence = 0.5;
        
        if (totalEmotionalWords > 0) {
            const positiveRatio = positiveCount / totalEmotionalWords;
            if (positiveRatio > 0.6) {
                sentiment = 'positive';
                confidence = positiveRatio;
            } else if (positiveRatio < 0.4) {
                sentiment = 'negative';
                confidence = 1 - positiveRatio;
            }
        }
        
        return {
            sentiment,
            confidence,
            positiveWords: positiveCount,
            negativeWords: negativeCount,
            keyPhrases: this.extractKeyPhrases(text)
        };
    }

    extractKeyPhrases(text) {
        // Simple key phrase extraction
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        return sentences.slice(0, 3).map(s => s.trim()).filter(s => s.length > 0);
    }

    displaySentimentResults(data) {
        const sentimentSection = document.getElementById('sentimentSection');
        const sentimentResults = document.getElementById('sentimentResults');
        
        if (!sentimentSection || !sentimentResults) return;

        const sentimentColor = {
            'positive': 'var(--mood-good)',
            'negative': 'var(--mood-bad)',
            'neutral': 'var(--mood-okay)'
        };

        sentimentResults.innerHTML = `
            <div class="sentiment-card" style="border-left: 4px solid ${sentimentColor[data.sentiment]}">
                <div class="sentiment-header">
                    <h3>Overall Sentiment: ${data.sentiment.charAt(0).toUpperCase() + data.sentiment.slice(1)}</h3>
                    <span class="confidence">Confidence: ${Math.round(data.confidence * 100)}%</span>
                </div>
                <div class="sentiment-stats">
                    <div class="stat">
                        <span class="stat-label">Positive Words</span>
                        <span class="stat-value">${data.positiveWords || 0}</span>
                    </div>
                    <div class="stat">
                        <span class="stat-label">Negative Words</span>
                        <span class="stat-value">${data.negativeWords || 0}</span>
                    </div>
                </div>
                ${data.keyPhrases && data.keyPhrases.length > 0 ? `
                    <div class="key-phrases">
                        <h4>Key Phrases:</h4>
                        <ul>
                            ${data.keyPhrases.map(phrase => `<li>"${phrase}"</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
            </div>
        `;

        sentimentSection.style.display = 'block';
        sentimentSection.scrollIntoView({ behavior: 'smooth' });
    }

    // ===== DAILY QUOTES =====
    async loadDailyQuote() {
        try {
            // Try ZenQuotes API
            const response = await fetch('https://api.quotable.io/random?tags=motivational,inspirational');
            if (response.ok) {
                const data = await response.json();
                this.displayQuote(data.content, data.author);
            } else {
                throw new Error('Quote API unavailable');
            }
        } catch (error) {
            // Fallback quotes
            const fallbackQuotes = [
                { content: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
                { content: "Life is what happens to you while you're busy making other plans.", author: "John Lennon" },
                { content: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
                { content: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
                { content: "The only impossible journey is the one you never begin.", author: "Tony Robbins" }
            ];
            
            const randomQuote = fallbackQuotes[Math.floor(Math.random() * fallbackQuotes.length)];
            this.displayQuote(randomQuote.content, randomQuote.author);
        }
    }

    displayQuote(content, author) {
        const quoteElement = document.getElementById('dailyQuote');
        const authorElement = document.getElementById('quoteAuthor');
        
        if (quoteElement) quoteElement.textContent = `"${content}"`;
        if (authorElement) authorElement.textContent = `- ${author}`;
    }

    // ===== VOICE RECOGNITION =====
    initializeVoiceRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';
            
            this.recognition.onresult = (event) => {
                let finalTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }
                
                if (finalTranscript) {
                    this.processVoiceCommand(finalTranscript);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.showToast('Voice recognition error', 'error');
                this.stopVoiceRecording();
            };
            
            this.recognition.onend = () => {
                this.isRecording = false;
                this.updateVoiceUI();
            };
        } else {
            console.warn('Speech recognition not supported');
        }
    }

    showVoiceModal() {
        const modal = document.getElementById('voiceModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    hideVoiceModal() {
        const modal = document.getElementById('voiceModal');
        if (modal) {
            modal.style.display = 'none';
        }
        
        if (this.isRecording) {
            this.stopVoiceRecording();
        }
    }

    startVoiceRecording() {
        if (!this.recognition) {
            this.showToast('Voice recognition not supported', 'error');
            return;
        }
        
        try {
            this.recognition.start();
            this.isRecording = true;
            this.updateVoiceUI();
            this.showToast('Listening...', 'info');
        } catch (error) {
            console.error('Error starting voice recognition:', error);
            this.showToast('Error starting voice recognition', 'error');
        }
    }

    stopVoiceRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
            this.isRecording = false;
            this.updateVoiceUI();
        }
    }

    updateVoiceUI() {
        const startBtn = document.getElementById('startRecording');
        const stopBtn = document.getElementById('stopRecording');
        const status = document.getElementById('recordingStatus');
        
        if (startBtn) startBtn.disabled = this.isRecording;
        if (stopBtn) stopBtn.disabled = !this.isRecording;
        
        if (status) {
            status.style.display = this.isRecording ? 'block' : 'none';
        }
    }

    processVoiceCommand(transcript) {
        const command = transcript.toLowerCase().trim();
        
        // Parse voice commands
        if (command.includes('what went well:')) {
            const content = command.split('what went well:')[1].trim();
            document.getElementById('wentWell').value = content;
        } else if (command.includes('could improve:')) {
            const content = command.split('could improve:')[1].trim();
            document.getElementById('couldImprove').value = content;
        } else if (command.includes('tomorrow goal:')) {
            const content = command.split('tomorrow goal:')[1].trim();
            document.getElementById('tomorrowGoal').value = content;
        } else if (command.includes('mood:')) {
            const moodText = command.split('mood:')[1].trim();
            const moodSelect = document.getElementById('moodSelect');
            
            // Map spoken words to mood values
            const moodMap = {
                'amazing': 'amazing',
                'great': 'amazing',
                'excellent': 'amazing',
                'good': 'good',
                'fine': 'good',
                'okay': 'okay',
                'ok': 'okay',
                'alright': 'okay',
                'bad': 'bad',
                'poor': 'bad',
                'terrible': 'terrible',
                'awful': 'terrible',
                'horrible': 'terrible'
            };
            
            for (const [key, value] of Object.entries(moodMap)) {
                if (moodText.includes(key)) {
                    moodSelect.value = value;
                    this.applyMoodTheme(value);
                    break;
                }
            }
        } else if (command.includes('mood note:')) {
            const content = command.split('mood note:')[1].trim();
            document.getElementById('moodNote').value = content;
        } else {
            // If no specific command, add to the first empty field
            const fields = ['wentWell', 'couldImprove', 'tomorrowGoal'];
            for (const fieldId of fields) {
                const field = document.getElementById(fieldId);
                if (field && !field.value) {
                    field.value = transcript;
                    break;
                }
            }
        }
        
        this.showToast('Voice command processed', 'success');
    }

    // ===== WEEKLY SUMMARY =====
    updateWeeklySummary() {
        const weeklyEntries = this.getWeeklyEntries();
        
        if (weeklyEntries.length === 0) {
            return;
        }
        
        // Calculate average mood
        const moodValues = { terrible: 1, bad: 2, okay: 3, good: 4, amazing: 5 };
        const averageMoodValue = weeklyEntries.reduce((sum, entry) => 
            sum + (moodValues[entry.mood] || 3), 0) / weeklyEntries.length;
        
        const averageMood = Object.keys(moodValues).find(key => 
            moodValues[key] === Math.round(averageMoodValue)) || 'okay';
        
        // Calculate trend
        const firstHalf = weeklyEntries.slice(0, Math.ceil(weeklyEntries.length / 2));
        const secondHalf = weeklyEntries.slice(Math.ceil(weeklyEntries.length / 2));
        
        const firstHalfAvg = firstHalf.reduce((sum, entry) => 
            sum + (moodValues[entry.mood] || 3), 0) / firstHalf.length;
        const secondHalfAvg = secondHalf.reduce((sum, entry) => 
            sum + (moodValues[entry.mood] || 3), 0) / secondHalf.length;
        
        const trend = secondHalfAvg > firstHalfAvg ? 'Improving' : 
                     secondHalfAvg < firstHalfAvg ? 'Declining' : 'Stable';
        
        // Find best day
        const bestEntry = weeklyEntries.reduce((best, entry) => 
            (moodValues[entry.mood] || 0) > (moodValues[best.mood] || 0) ? entry : best);
        const bestDay = new Date(bestEntry.date).toLocaleDateString('en-US', { weekday: 'long' });
        
        // Count goals achieved (assuming goals from previous days)
        const goalsAchieved = weeklyEntries.filter(entry => 
            entry.wentWell && entry.wentWell.toLowerCase().includes('goal')).length;
        const totalGoals = weeklyEntries.length;
        
        // Update UI
        const averageMoodEl = document.getElementById('averageMood');
        const moodTrendEl = document.getElementById('moodTrend');
        const bestDayEl = document.getElementById('bestDay');
        const goalsAchievedEl = document.getElementById('goalsAchieved');
        
        if (averageMoodEl) averageMoodEl.textContent = averageMood.charAt(0).toUpperCase() + averageMood.slice(1);
        if (moodTrendEl) {
            moodTrendEl.textContent = trend;
            moodTrendEl.className = `summary-value trending-${trend.toLowerCase()}`;
        }
        if (bestDayEl) bestDayEl.textContent = bestDay;
        if (goalsAchievedEl) goalsAchievedEl.textContent = `${goalsAchieved}/${totalGoals}`;
    }

    getWeeklyEntries() {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        return this.journalEntries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= oneWeekAgo;
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // ===== ANALYTICS AND CHARTS =====
    renderAnalytics() {
        const timeframe = document.getElementById('analyticsTimeframe')?.value || 'week';
        const entries = this.getEntriesForTimeframe(timeframe);
        
        this.renderMoodTrendChart(entries);
        this.renderMoodDistributionChart(entries);
        this.renderStreakChart();
        this.updateTopPhrases(entries);
    }

    getEntriesForTimeframe(timeframe) {
        const now = new Date();
        let cutoffDate;
        
        switch (timeframe) {
            case 'week':
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                break;
            case 'quarter':
                cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                break;
            default:
                cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        }
        
        return this.journalEntries.filter(entry => new Date(entry.date) >= cutoffDate)
                                  .sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    renderMoodTrendChart(entries) {
        const canvas = document.getElementById('moodTrendChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const moodValues = { terrible: 1, bad: 2, okay: 3, good: 4, amazing: 5 };
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (entries.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        const padding = 40;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;
        
        // Draw axes
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, canvas.height - padding);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, canvas.height - padding);
        ctx.lineTo(canvas.width - padding, canvas.height - padding);
        ctx.stroke();
        
        // Plot mood trend line
        if (entries.length > 1) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            entries.forEach((entry, index) => {
                const x = padding + (index / (entries.length - 1)) * chartWidth;
                const moodValue = moodValues[entry.mood] || 3;
                const y = canvas.height - padding - ((moodValue - 1) / 4) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // Add dots
            ctx.fillStyle = '#3b82f6';
            entries.forEach((entry, index) => {
                const x = padding + (index / (entries.length - 1)) * chartWidth;
                const moodValue = moodValues[entry.mood] || 3;
                const y = canvas.height - padding - ((moodValue - 1) / 4) * chartHeight;
                
                ctx.beginPath();
                ctx.arc(x, y, 3, 0, 2 * Math.PI);
                ctx.fill();
            });
        }
        
        // Add labels
        ctx.fillStyle = '#64748b';
        ctx.font = '12px Inter';
        ctx.textAlign = 'right';
        
        // Y-axis labels
        const moodLabels = ['Terrible', 'Bad', 'Okay', 'Good', 'Amazing'];
        moodLabels.forEach((label, index) => {
            const y = canvas.height - padding - (index / 4) * chartHeight;
            ctx.fillText(label, padding - 10, y + 4);
        });
    }

    renderMoodDistributionChart(entries) {
        const canvas = document.getElementById('moodDistributionChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (entries.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '14px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Count mood occurrences
        const moodCounts = { terrible: 0, bad: 0, okay: 0, good: 0, amazing: 0 };
        entries.forEach(entry => {
            if (entry.mood && moodCounts.hasOwnProperty(entry.mood)) {
                moodCounts[entry.mood]++;
            }
        });
        
        const moodColors = {
            terrible: '#dc2626',
            bad: '#ef4444',
            okay: '#f59e0b',
            good: '#84cc16',
            amazing: '#10b981'
        };
        
        // Calculate angles
        const total = entries.length;
        let currentAngle = -Math.PI / 2; // Start at top
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 40;
        
        // Draw pie chart
        Object.entries(moodCounts).forEach(([mood, count]) => {
            if (count > 0) {
                const sliceAngle = (count / total) * 2 * Math.PI;
                
                ctx.fillStyle = moodColors[mood];
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                ctx.closePath();
                ctx.fill();
                
                // Add percentage label
                if (sliceAngle > 0.1) { // Only show label if slice is big enough
                    const labelAngle = currentAngle + sliceAngle / 2;
                    const labelX = centerX + Math.cos(labelAngle) * (radius * 0.7);
                    const labelY = centerY + Math.sin(labelAngle) * (radius * 0.7);
                    
                    ctx.fillStyle = 'white';
                    ctx.font = 'bold 12px Inter';
                    ctx.textAlign = 'center';
                    const percentage = Math.round((count / total) * 100);
                    ctx.fillText(`${percentage}%`, labelX, labelY);
                }
                
                currentAngle += sliceAngle;
            }
        });
    }

    renderStreakChart() {
        const canvas = document.getElementById('streakChart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Simple streak visualization - show last 30 days
        const today = new Date();
        const days = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            days.push(date);
        }
        
        const padding = 20;
        const cellSize = (canvas.width - 2 * padding) / 30;
        const startY = canvas.height / 2 - cellSize / 2;
        
        days.forEach((date, index) => {
            const dateString = date.toISOString().split('T')[0];
            const hasEntry = this.journalEntries.some(entry => entry.date === dateString);
            
            const x = padding + index * cellSize;
            const y = startY;
            
            ctx.fillStyle = hasEntry ? '#10b981' : '#e2e8f0';
            ctx.fillRect(x, y, cellSize - 2, cellSize - 2);
        });
        
        // Add title
        ctx.fillStyle = '#374151';
        ctx.font = '12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText('Last 30 Days Activity', canvas.width / 2, 20);
    }

    updateTopPhrases(entries) {
        const phrasesContainer = document.getElementById('topPhrases');
        if (!phrasesContainer) return;
        
        // Extract and count phrases
        const phrases = {};
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'is', 'was', 'were', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
        
        entries.forEach(entry => {
            const text = `${entry.wentWell || ''} ${entry.couldImprove || ''} ${entry.tomorrowGoal || ''}`.toLowerCase();
            
            // Extract 2-3 word phrases
            const words = text.split(/\W+/).filter(word => word.length > 2 && !commonWords.has(word));
            
            for (let i = 0; i < words.length - 1; i++) {
                const phrase = `${words[i]} ${words[i + 1]}`;
                phrases[phrase] = (phrases[phrase] || 0) + 1;
            }
        });
        
        // Sort and get top phrases
        const topPhrases = Object.entries(phrases)
            .filter(([phrase, count]) => count > 1)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
        
        // Update UI
        phrasesContainer.innerHTML = topPhrases.length > 0 
            ? topPhrases.map(([phrase, count]) => `
                <div class="phrase-item">
                    <span class="phrase">"${phrase}"</span>
                    <span class="count">${count}</span>
                </div>
            `).join('')
            : '<div class="phrase-item"><span class="phrase">No common phrases yet</span></div>';
    }

    // ===== PDF EXPORT =====
    async exportToPDF() {
        try {
            this.showLoading(true);
            
            // Get last week's entries
            const weeklyEntries = this.getWeeklyEntries();
            
            if (weeklyEntries.length === 0) {
                this.showToast('No entries to export', 'error');
                return;
            }
            
            // Create PDF content
            const pdfContent = this.generatePDFContent(weeklyEntries);
            
            // Use html2pdf if available, otherwise fallback to simple download
            if (typeof html2pdf !== 'undefined') {
                const element = document.createElement('div');
                element.innerHTML = pdfContent;
                element.style.padding = '20px';
                element.style.fontFamily = 'Arial, sans-serif';
                
                const opt = {
                    margin: 1,
                    filename: `journify-export-${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2 },
                    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
                };
                
                await html2pdf().set(opt).from(element).save();
                this.showToast('PDF exported successfully!', 'success');
            } else {
                // Fallback: download as text file
                this.downloadAsText(weeklyEntries);
            }
            
        } catch (error) {
            console.error('Error exporting PDF:', error);
            this.showToast('Error exporting PDF', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    generatePDFContent(entries) {
        const startDate = entries[0]?.date || new Date().toISOString().split('T')[0];
        const endDate = entries[entries.length - 1]?.date || new Date().toISOString().split('T')[0];
        
        let content = `
            <h1 style="color: #3b82f6; text-align: center; margin-bottom: 30px;">
                Journify Weekly Report
            </h1>
            <p style="text-align: center; color: #64748b; margin-bottom: 40px;">
                ${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}
            </p>
        `;
        
        entries.forEach(entry => {
            const date = new Date(entry.date).toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            content += `
                <div style="margin-bottom: 30px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                    <h2 style="color: #1e293b; margin-bottom: 10px;">${date}</h2>
                    <p style="color: #3b82f6; font-weight: bold; margin-bottom: 15px;">
                        Mood: ${entry.mood?.charAt(0).toUpperCase() + entry.mood?.slice(1) || 'Not specified'}
                        ${entry.moodNote ? ` - ${entry.moodNote}` : ''}
                    </p>
                    
                    ${entry.wentWell ? `
                        <h3 style="color: #059669; margin-bottom: 5px;">What went well:</h3>
                        <p style="margin-bottom: 15px; line-height: 1.6;">${entry.wentWell}</p>
                    ` : ''}
                    
                    ${entry.couldImprove ? `
                        <h3 style="color: #dc2626; margin-bottom: 5px;">What could be improved:</h3>
                        <p style="margin-bottom: 15px; line-height: 1.6;">${entry.couldImprove}</p>
                    ` : ''}
                    
                    ${entry.tomorrowGoal ? `
                        <h3 style="color: #7c3aed; margin-bottom: 5px;">Goal for tomorrow:</h3>
                        <p style="margin-bottom: 15px; line-height: 1.6;">${entry.tomorrowGoal}</p>
                    ` : ''}
                </div>
            `;
        });
        
        // Add summary
        const moodCounts = {};
        entries.forEach(entry => {
            if (entry.mood) {
                moodCounts[entry.mood] = (moodCounts[entry.mood] || 0) + 1;
            }
        });
        
        content += `
            <div style="margin-top: 40px; padding: 20px; background-color: #f8fafc; border-radius: 8px;">
                <h2 style="color: #1e293b; margin-bottom: 20px;">Week Summary</h2>
                <p><strong>Total Entries:</strong> ${entries.length}</p>
                <p><strong>Mood Distribution:</strong></p>
                <ul style="margin-left: 20px;">
                    ${Object.entries(moodCounts).map(([mood, count]) => 
                        `<li>${mood.charAt(0).toUpperCase() + mood.slice(1)}: ${count} days</li>`
                    ).join('')}
                </ul>
            </div>
        `;
        
        return content;
    }

    downloadAsText(entries) {
        const textContent = entries.map(entry => {
            const date = new Date(entry.date).toDateString();
            return `
=== ${date} ===
Mood: ${entry.mood || 'Not specified'}${entry.moodNote ? ` - ${entry.moodNote}` : ''}

What went well:
${entry.wentWell || 'Not specified'}

What could be improved:
${entry.couldImprove || 'Not specified'}

Goal for tomorrow:
${entry.tomorrowGoal || 'Not specified'}

---
            `;
        }).join('\n');
        
        const blob = new Blob([textContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `journify-export-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Journal exported as text file', 'success');
    }

    // ===== UTILITY FUNCTIONS =====
    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            loadingOverlay.style.display = show ? 'flex' : 'none';
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }

    // Format date for display
    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    // Debounce function for performance
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.journifyApp = new JournifyApp();
});

// Export for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JournifyApp;
}