// State Management
let appState = {
    releaseNotes: [],
    selectedUpdate: null,
    searchQuery: '',
    selectedCategory: 'all',
    lastFetched: null
};

// DOM Elements
const timelineContainer = document.getElementById('timelineContainer');
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const categoryFilters = document.querySelectorAll('.filter-badge');

// Composer Elements
const composerEmptyState = document.getElementById('composerEmptyState');
const composerEditorForm = document.getElementById('composerEditorForm');
const infoBadge = document.getElementById('infoBadge');
const infoDate = document.getElementById('infoDate');
const tweetTextarea = document.getElementById('tweetTextarea');
const charCountText = document.getElementById('charCountText');
const progressRingCircle = document.getElementById('progressRingCircle');
const copyTextBtn = document.getElementById('copyTextBtn');
const tweetIntentBtn = document.getElementById('tweetIntentBtn');
const sandboxContent = document.getElementById('sandboxContent');
const toastContainer = document.getElementById('toastContainer');

// Progress Ring Configuration
const ringRadius = 11;
const ringCircumference = 2 * Math.PI * ringRadius;
progressRingCircle.style.strokeDasharray = `${ringCircumference} ${ringCircumference}`;
progressRingCircle.style.strokeDashoffset = ringCircumference;

/* ==========================================================================
   Initialization & Event Listeners
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    // Initial fetch
    fetchReleaseNotes(false);

    // Refresh Feed
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search input handler
    searchInput.addEventListener('input', (e) => {
        appState.searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = appState.searchQuery ? 'block' : 'none';
        renderTimeline();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        appState.searchQuery = '';
        clearSearchBtn.style.display = 'none';
        renderTimeline();
    });

    // Category filter badges
    categoryFilters.forEach(badge => {
        badge.addEventListener('click', () => {
            categoryFilters.forEach(b => b.classList.remove('active'));
            badge.classList.add('active');
            appState.selectedCategory = badge.dataset.category;
            renderTimeline();
        });
    });

    // Tweet textarea live input
    tweetTextarea.addEventListener('input', () => {
        updateTweetStats();
    });

    // Copy text action
    copyTextBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(tweetTextarea.value)
            .then(() => showToast('Copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy text', 'error'));
    });

    // Tweet Intent action
    tweetIntentBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        if (!text.trim()) return;
        
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank', 'width=600,height=400,resizable=yes');
    });
});

/* ==========================================================================
   Data Fetching & Cache Management
   ========================================================================== */
async function fetchReleaseNotes(forceRefresh = false) {
    // UI Loading State
    setLoadingState(true);
    
    const endpoint = forceRefresh ? '/api/refresh' : '/api/notes';
    const method = forceRefresh ? 'POST' : 'GET';
    
    try {
        const response = await fetch(endpoint, { method });
        const data = await response.json();
        
        if (data.status === 'success' || data.status === 'error_fallback') {
            appState.releaseNotes = data.notes;
            appState.lastFetched = data.last_fetched;
            
            // Render the UI
            renderTimeline();
            
            // Update Status Banner
            const localTime = new Date(data.last_fetched).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            if (data.cached) {
                statusIndicator.className = 'status-indicator error';
                statusText.textContent = `Offline: Cached notes (${localTime})`;
                showToast(data.message || 'Showing cached data due to connection issues', 'error');
            } else {
                statusIndicator.className = 'status-indicator';
                statusText.textContent = `Updated: ${localTime}`;
                if (forceRefresh) {
                    showToast('Feed refreshed successfully!', 'success');
                }
            }
        } else {
            throw new Error(data.message || 'API responded with an error');
        }
    } catch (error) {
        console.error('Failed to fetch release notes:', error);
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Connection Error';
        showToast(`Failed to connect: ${error.message}`, 'error');
        
        // Render empty state if no existing notes
        if (appState.releaseNotes.length === 0) {
            renderEmptyState('Connection failed and no cached data is available.');
        }
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    if (isLoading) {
        refreshBtn.classList.add('btn-refresh-loading');
        refreshIcon.style.animation = 'spin 1s linear infinite';
        statusIndicator.classList.add('loading');
        statusText.textContent = 'Syncing feed...';
    } else {
        refreshBtn.classList.remove('btn-refresh-loading');
        refreshIcon.style.animation = 'none';
        statusIndicator.classList.remove('loading');
    }
}

/* ==========================================================================
   UI Rendering
   ========================================================================== */
function renderTimeline() {
    timelineContainer.innerHTML = '';
    
    // Filter the notes based on Category and Search Query
    const filteredDays = [];
    
    appState.releaseNotes.forEach(day => {
        const matchingUpdates = day.updates.filter(update => {
            const matchesCategory = appState.selectedCategory === 'all' || update.type === appState.selectedCategory;
            const matchesSearch = !appState.searchQuery || 
                update.type.toLowerCase().includes(appState.searchQuery) || 
                update.text.toLowerCase().includes(appState.searchQuery) ||
                day.date.toLowerCase().includes(appState.searchQuery);
            return matchesCategory && matchesSearch;
        });
        
        if (matchingUpdates.length > 0) {
            filteredDays.push({
                ...day,
                updates: matchingUpdates
            });
        }
    });

    if (filteredDays.length === 0) {
        renderEmptyState('No updates match your filters or search keywords.');
        return;
    }

    // Build timeline DOM
    filteredDays.forEach(day => {
        const dayGroup = document.createElement('div');
        dayGroup.className = 'timeline-day-group';
        
        const dateHeader = document.createElement('div');
        dateHeader.className = 'timeline-date-header';
        dateHeader.textContent = day.date;
        dayGroup.appendChild(dateHeader);
        
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'timeline-day-cards';
        
        day.updates.forEach(update => {
            const card = document.createElement('article');
            card.className = 'update-card';
            card.dataset.id = update.id;
            
            // Check if selected
            if (appState.selectedUpdate && appState.selectedUpdate.id === update.id) {
                card.classList.add('selected');
            }
            
            // Badge class
            const badgeClass = `badge-${update.type.toLowerCase()}`;
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${badgeClass}">${update.type}</span>
                    <button class="tweet-action-btn" title="Tweet this update">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </button>
                </div>
                <div class="card-content">
                    ${update.html}
                </div>
            `;
            
            // Card selection click
            card.addEventListener('click', (e) => {
                // If clicked specifically on the tweet quick button, still select but immediately focus tweet composer
                selectUpdate(update, day);
            });
            
            // Tweet button click inside card
            const tweetBtn = card.querySelector('.tweet-action-btn');
            tweetBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Avoid double toggle
                selectUpdate(update, day);
                tweetIntentBtn.focus();
                // Smooth scroll to composer on small screens
                if (window.innerWidth <= 1024) {
                    composerPanel.scrollIntoView({ behavior: 'smooth' });
                }
            });
            
            cardsContainer.appendChild(card);
        });
        
        dayGroup.appendChild(cardsContainer);
        timelineContainer.appendChild(dayGroup);
    });
}

function renderEmptyState(message) {
    timelineContainer.innerHTML = `
        <div class="no-results">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <h3>No release notes found</h3>
            <p>${message}</p>
        </div>
    `;
}

/* ==========================================================================
   Tweet Composition & Formatting
   ========================================================================== */
function selectUpdate(update, day) {
    appState.selectedUpdate = update;
    
    // Highlight active card
    document.querySelectorAll('.update-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.id === update.id) {
            card.classList.add('selected');
        }
    });
    
    // Toggle side composer visibility
    composerEmptyState.style.display = 'none';
    composerEditorForm.style.display = 'flex';
    
    // Setup metadata
    infoBadge.className = `badge badge-${update.type.toLowerCase()}`;
    infoBadge.textContent = update.type;
    infoDate.textContent = day.date;
    
    // Generate draft
    tweetTextarea.value = generateTweetDraft(update, day);
    
    // Update stats & visual progress
    updateTweetStats();
    
    // Scroll to panel on mobile
    if (window.innerWidth <= 1024 && document.activeElement !== tweetTextarea) {
        composerPanel.scrollIntoView({ behavior: 'smooth' });
    }
}

function generateTweetDraft(update, day) {
    const typeLabel = update.type.toUpperCase();
    const cleanDate = day.date;
    
    // Base layout:
    // "BigQuery Release Update [Date] | [Type]:"
    // "[Truncated Content]"
    // "Details: [Link]"
    
    const prefix = `BigQuery Update (${cleanDate}) • [${typeLabel}]\n\n`;
    const canonicalLink = day.link || 'https://cloud.google.com/bigquery/docs/release-notes';
    const linkSection = `\n\nDetails: ${canonicalLink}`;
    
    // Twitter's URL count rule: any URL is counted as exactly 23 characters.
    // Length calculations:
    // Max characters = 280
    // Budget prefix length + newline spacing (which is 23 characters for link + 10 chars layout)
    // Let's compute text budgets directly:
    const prefixLength = prefix.length;
    const urlLengthForTwitter = 23; 
    const linkLabelLength = "Details: ".length + 2; // +2 for newlines
    
    const budget = 280 - prefixLength - urlLengthForTwitter - linkLabelLength;
    
    // Retrieve clean text content
    let text = update.text;
    
    // Clean double spaces or excessive newlines
    text = text.replace(/\s+/g, ' ').trim();
    
    if (text.length > budget) {
        // Truncate text to fit budget
        text = text.substring(0, budget - 3) + '...';
    }
    
    return `${prefix}${text}${linkSection}`;
}

function updateTweetStats() {
    const text = tweetTextarea.value;
    const stats = calculateTwitterLength(text);
    
    charCountText.textContent = `${stats.length} / 280`;
    
    // Color alert states
    charCountText.classList.remove('warning', 'danger');
    if (stats.length > 280) {
        charCountText.classList.add('danger');
        progressRingCircle.style.stroke = 'var(--color-issue)';
    } else if (stats.length >= 250) {
        charCountText.classList.add('warning');
        progressRingCircle.style.stroke = 'var(--color-deprecation)';
    } else {
        progressRingCircle.style.stroke = 'var(--color-secondary)';
    }
    
    // Visual progress ring update
    const percent = Math.min(100, (stats.length / 280) * 100);
    const strokeOffset = ringCircumference - (percent / 100) * ringCircumference;
    progressRingCircle.style.strokeDashoffset = strokeOffset;
    
    // Live sandbox preview render
    // Convert links inside preview to anchors
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const htmlPreview = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(urlRegex, '<span style="color: #1d9bf0;">$1</span>')
        .replace(/\n/g, '<br>');
        
    sandboxContent.innerHTML = htmlPreview || '<span style="color: #71767b;">Tweet text will preview here...</span>';
}

/**
 * Calculates string length according to Twitter rules.
 * All URLs are counted as exactly 23 characters.
 */
function calculateTwitterLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let length = text.length;
    let match;
    
    // Match URLs and recalculate
    while ((match = urlRegex.exec(text)) !== null) {
        const urlActualLength = match[0].length;
        length = length - urlActualLength + 23;
    }
    
    return {
        length: length
    };
}

/* ==========================================================================
   Toast Notifications
   ========================================================================== */
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconSvg = type === 'success' 
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
        
    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-text">${message}</div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Remove after animation finishes
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3500);
}
