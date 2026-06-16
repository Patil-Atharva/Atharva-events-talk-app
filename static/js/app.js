// Global Application State
const state = {
    allReleases: [],      // Original fetched releases from Flask API
    filteredReleases: [], // Releases after search and type filter are applied
    activeFilter: 'all',  // 'all', 'Feature', 'Change', 'Issue', 'Breaking', 'Announcement'
    searchQuery: '',      // Search string
    sortOrder: 'desc',    // 'desc' (latest first) or 'asc' (oldest first)
    isLoaded: false
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('theme-toggle'),
    refreshButton: document.getElementById('refresh-button'),
    refreshIcon: document.querySelector('#refresh-button .refresh-icon'),
    apiStatus: document.getElementById('api-status'),
    statusDot: document.querySelector('.status-dot'),
    valTotal: document.getElementById('val-total'),
    valFeatures: document.getElementById('val-features'),
    valBreaking: document.getElementById('val-breaking'),
    valLatest: document.getElementById('val-latest'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    filterChipsContainer: document.getElementById('filter-chips-container'),
    resultsCount: document.getElementById('results-count'),
    sortSelect: document.getElementById('sort-select'),
    exportCsvButton: document.getElementById('export-csv-button'),
    timelineContainer: document.getElementById('timeline-container'),
    toastContainer: document.getElementById('toast-container')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    setupEventListeners();
    fetchReleases();
});

// Theme Management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    showToast(`Switched to ${newTheme} mode`);
}

// Setup Event Listeners
function setupEventListeners() {
    // Theme Switcher
    elements.themeToggle.addEventListener('click', toggleTheme);

    // Refresh Button
    elements.refreshButton.addEventListener('click', triggerManualRefresh);

    // Export CSV Button
    elements.exportCsvButton.addEventListener('click', exportToCSV);

    // Search Input
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        toggleClearSearchButton();
        applyFilters();
    });

    // Clear Search Button
    elements.clearSearch.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        toggleClearSearchButton();
        applyFilters();
        elements.searchInput.focus();
    });

    // Filter Chips
    elements.filterChipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;

        // Update active chip UI
        elements.filterChipsContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        // Update state and apply filter
        state.activeFilter = chip.getAttribute('data-filter');
        applyFilters();
    });

    // Sort Selector
    elements.sortSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        applyFilters();
    });
}

function toggleClearSearchButton() {
    if (state.searchQuery) {
        elements.clearSearch.style.display = 'flex';
    } else {
        elements.clearSearch.style.display = 'none';
    }
}

// Fetch Release Notes from Flask Server
async function fetchReleases(force = false) {
    try {
        updateAPIStatus('connecting', 'Connecting...');
        const url = force ? '/api/releases?force=true' : '/api/releases';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            state.allReleases = data.releases;
            state.isLoaded = true;
            
            updateAPIStatus('connected', 'Live / Synced');
            calculateDashboardMetrics(state.allReleases);
            applyFilters(); // Initial render
            
            if (force) {
                showToast('Releases feed updated live!');
            }
            
            // Check for deep links in URL Hash
            handleDeepLink();
        } else {
            throw new Error(data.message || 'Unknown server error');
        }
    } catch (error) {
        console.error('Failed to load release notes:', error);
        updateAPIStatus('error', 'Sync Error');
        renderErrorState(error.message);
        showToast('Error loading releases: ' + error.message, 'error');
    } finally {
        elements.refreshIcon.classList.remove('spinning');
    }
}

// Manual Trigger for Refreshing Feed
function triggerManualRefresh() {
    if (elements.refreshIcon.classList.contains('spinning')) return;
    elements.refreshIcon.classList.add('spinning');
    fetchReleases(true);
}

function updateAPIStatus(status, label) {
    elements.apiStatus.textContent = label;
    elements.statusDot.className = 'status-dot';
    
    if (status === 'connecting') {
        elements.statusDot.classList.add('pulsing');
    } else if (status === 'connected') {
        // Just standard static dot
    } else if (status === 'error') {
        elements.statusDot.classList.add('error');
    }
}

// Analytics and Metrics
function calculateDashboardMetrics(releases) {
    let totalItemsCount = 0;
    let featuresCount = 0;
    let breakingCount = 0;
    let latestDateText = 'No updates';
    
    if (releases.length > 0) {
        // Latest date is the first item in raw feed
        latestDateText = releases[0].date;
        
        releases.forEach(rel => {
            totalItemsCount += rel.items.length;
            rel.items.forEach(item => {
                if (item.type === 'Feature') {
                    featuresCount++;
                } else if (item.type === 'Breaking' || item.type === 'Issue') {
                    breakingCount++;
                }
            });
        });
    }

    elements.valTotal.textContent = totalItemsCount;
    elements.valFeatures.textContent = featuresCount;
    elements.valBreaking.textContent = breakingCount;
    elements.valLatest.textContent = latestDateText;
}

// Combined Search & Filter Logic
function applyFilters() {
    if (!state.isLoaded) return;
    
    let result = [];

    // Deep clone the releases array structure so we can filter sub-items without altering originals
    state.allReleases.forEach(rel => {
        const matchingItems = rel.items.filter(item => {
            // 1. Type Filter
            const matchesType = state.activeFilter === 'all' || item.type === state.activeFilter;
            
            // 2. Search Query Filter
            const contentText = item.content.toLowerCase();
            const typeText = item.type.toLowerCase();
            const dateText = rel.date.toLowerCase();
            const matchesSearch = !state.searchQuery || 
                                  contentText.includes(state.searchQuery) || 
                                  typeText.includes(state.searchQuery) ||
                                  dateText.includes(state.searchQuery);
                                  
            return matchesType && matchesSearch;
        });

        // Only include the release date group if it has matching items
        if (matchingItems.length > 0) {
            result.push({
                ...rel,
                items: matchingItems
            });
        }
    });

    // 3. Sorting
    result.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        if (state.sortOrder === 'asc') {
            return dateA - dateB;
        } else {
            return dateB - dateA;
        }
    });

    state.filteredReleases = result;
    renderTimeline();
    renderResultsCount();
}

function renderResultsCount() {
    let totalItems = 0;
    state.filteredReleases.forEach(rel => {
        totalItems += rel.items.length;
    });

    let text = `Showing ${totalItems} update${totalItems !== 1 ? 's' : ''}`;
    if (state.activeFilter !== 'all') {
        text += ` matching filter "${state.activeFilter}"`;
    }
    if (state.searchQuery) {
        text += ` containing "${state.searchQuery}"`;
    }
    elements.resultsCount.textContent = text;
}

// Render Timeline Feed UI
function renderTimeline() {
    elements.timelineContainer.innerHTML = '';

    if (state.filteredReleases.length === 0) {
        renderEmptyState();
        return;
    }

    state.filteredReleases.forEach(rel => {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        
        // Clean ID for deep linking
        const dateId = rel.date.replace(/[^a-zA-Z0-9]/g, '_');
        groupEl.id = `release-${dateId}`;

        // Date header HTML
        const headerEl = document.createElement('div');
        headerEl.className = 'timeline-date-header';
        
        // Date Text
        const titleSpan = document.createElement('span');
        titleSpan.textContent = rel.date;
        headerEl.appendChild(titleSpan);

        // Share/Deep link button
        const linkEl = document.createElement('a');
        linkEl.href = `#release-${dateId}`;
        linkEl.className = 'timeline-date-link';
        linkEl.title = 'Copy link to this release date';
        linkEl.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
            <span>Link</span>
        `;
        
        linkEl.addEventListener('click', (e) => {
            e.preventDefault();
            const shareUrl = `${window.location.origin}${window.location.pathname}#release-${dateId}`;
            navigator.clipboard.writeText(shareUrl).then(() => {
                showToast('Link copied to clipboard!');
                window.location.hash = `release-${dateId}`;
            });
        });
        
        headerEl.appendChild(linkEl);
        groupEl.appendChild(headerEl);

        // Items inside date
        rel.items.forEach(item => {
            const cardEl = document.createElement('article');
            cardEl.className = 'release-card';

            const itemHeader = document.createElement('div');
            itemHeader.className = 'release-item-header';

            const badgeClass = item.type.toLowerCase();
            const badgeEl = document.createElement('span');
            badgeEl.className = `badge ${badgeClass}`;
            badgeEl.textContent = item.type;
            
            // Action Buttons Container
            const actionsEl = document.createElement('div');
            actionsEl.className = 'release-item-actions';

            // Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-card-button';
            copyBtn.title = 'Copy text to clipboard';
            copyBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
            `;
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const plainText = item.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                navigator.clipboard.writeText(`BigQuery Release (${rel.date}) - [${item.type}]: ${plainText}`).then(() => {
                    showToast('Copied to clipboard!');
                });
            });

            // Tweet Button
            const tweetBtn = document.createElement('button');
            tweetBtn.className = 'tweet-button';
            tweetBtn.title = 'Tweet about this update';
            tweetBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span>Tweet</span>
            `;
            tweetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                shareOnTwitter(rel.date, item.type, item.content, rel.link);
            });
            
            actionsEl.appendChild(copyBtn);
            actionsEl.appendChild(tweetBtn);
            
            itemHeader.appendChild(badgeEl);
            itemHeader.appendChild(actionsEl);
            cardEl.appendChild(itemHeader);

            const contentEl = document.createElement('div');
            contentEl.className = 'release-content';
            contentEl.innerHTML = item.content;
            
            cardEl.appendChild(contentEl);
            groupEl.appendChild(cardEl);
        });

        elements.timelineContainer.appendChild(groupEl);
    });
}

// Render Empty/Error States
function renderEmptyState() {
    elements.timelineContainer.innerHTML = `
        <div class="no-results card">
            <svg class="no-results-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <h3 class="no-results-title">No release notes found</h3>
            <p class="no-results-desc">We couldn't find any updates matching your filters or search keywords. Try adjusting your search query or choosing another type.</p>
        </div>
    `;
}

function renderErrorState(message) {
    elements.timelineContainer.innerHTML = `
        <div class="no-results card" style="border-color: var(--tag-breaking-border); background-color: var(--tag-breaking-bg);">
            <svg class="no-results-icon" style="color: var(--tag-breaking);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
            <h3 class="no-results-title" style="color: var(--tag-breaking);">Failed to sync feed</h3>
            <p class="no-results-desc" style="color: var(--text-color);">${message || 'Please check your connection and try again later.'}</p>
            <button onclick="window.location.reload()" class="chip" style="margin-top: 1rem; border-color: var(--tag-breaking-border);">
                Retry Connection
            </button>
        </div>
    `;
}

// Deep Linking to Date Anchors
function handleDeepLink() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#release-')) {
        setTimeout(() => {
            const targetEl = document.getElementById(hash.substring(1));
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight target card temporarily
                targetEl.style.outline = '2px solid var(--primary)';
                targetEl.style.outlineOffset = '4px';
                targetEl.style.borderRadius = 'var(--border-radius-md)';
                setTimeout(() => {
                    targetEl.style.transition = 'outline var(--transition-normal)';
                    targetEl.style.outline = 'none';
                }, 3000);
            }
        }, 300);
    }
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // Icon based on type
    let iconSvg = '';
    if (type === 'error') {
        iconSvg = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
    } else {
        iconSvg = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 16 12 12 12 8"></polyline>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
    }
    
    toast.innerHTML = `${iconSvg} <span>${message}</span>`;
    elements.toastContainer.appendChild(toast);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3000);

    toast.addEventListener('click', () => {
        toast.remove();
    });
}

// Share specific release note item on X/Twitter
function shareOnTwitter(date, type, htmlContent, officialLink) {
    // Strip HTML tags and normalize spacing to create plain text
    const plainText = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    
    const prefix = `BigQuery Release (${date}) - [${type}]: `;
    const suffix = ` #BigQuery #GCP`;
    
    // Twitter/X post character limit is 280.
    // Shared URLs are wrapped in t.co which counts as 23 characters.
    const maxBodyLen = 280 - 23 - prefix.length - suffix.length - 5;
    
    let body = plainText;
    if (body.length > maxBodyLen) {
        body = body.substring(0, maxBodyLen - 3) + '...';
    }
    
    const tweetText = `${prefix}${body}${suffix}`;
    const shareUrl = officialLink || 'https://cloud.google.com/bigquery/docs/release-notes';
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank');
    showToast('Opening Twitter composition window...');
}

// Export the currently filtered release notes to a CSV file
function exportToCSV() {
    if (!state.filteredReleases || state.filteredReleases.length === 0) {
        showToast('No releases to export!', 'error');
        return;
    }
    
    let csvContent = "\ufeffDate,Type,Content,Link\n"; // Add UTF-8 BOM
    
    state.filteredReleases.forEach(rel => {
        rel.items.forEach(item => {
            const plainContent = item.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
            
            const row = [
                escapeCSVField(rel.date),
                escapeCSVField(item.type),
                escapeCSVField(plainContent),
                escapeCSVField(rel.link)
            ];
            
            csvContent += row.join(",") + "\n";
        });
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    let filename = "bigquery_release_notes";
    if (state.activeFilter !== 'all') {
        filename += `_${state.activeFilter.toLowerCase()}`;
    }
    if (state.searchQuery) {
        filename += `_search`;
    }
    filename += ".csv";
    
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Exported CSV successfully!');
}

// Helper to escape double quotes and wrap cells in quotes for CSV formats
function escapeCSVField(field) {
    if (field === null || field === undefined) return '';
    let stringValue = String(field);
    if (stringValue.includes('"') || stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('\r')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}
