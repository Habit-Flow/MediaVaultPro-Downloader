// MediaVault Pro - Complete JavaScript with Backend Integration

// ====================================
// IMPORTANT: Replace with your Render backend URL
// ====================================
const API_URL = 'https://your-app-name.onrender.com'; // CHANGE THIS TO YOUR RENDER URL!

// DOM Elements
const hamburger = document.getElementById('hamburger');
const navMenu = document.getElementById('navMenu');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const faqItems = document.querySelectorAll('.faq-item');
const progressModal = document.getElementById('progressModal');
const loadingScreen = document.getElementById('loadingScreen');
const apiStatus = document.getElementById('apiStatus');

// Global variables
let currentVideoData = null;
let currentAudioData = null;
let batchVideos = [];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    await checkAPIStatus();
    setTimeout(() => {
        loadingScreen.classList.add('hidden');
    }, 1000);
    initializeEventListeners();
}

// Check API Status
async function checkAPIStatus() {
    const statusIndicator = apiStatus.querySelector('.status-indicator');
    const statusText = apiStatus.querySelector('.status-text');
    
    try {
        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            mode: 'cors'
        });
        
        if (response.ok) {
            statusIndicator.classList.add('online');
            statusText.textContent = 'Online';
            showNotification('✅ Connected to MediaVault servers', 'success');
        } else {
            throw new Error('API not responding');
        }
    } catch (error) {
        statusIndicator.classList.add('offline');
        statusText.textContent = 'Offline';
        showNotification('⚠️ Server is starting up, please wait...', 'warning');
        setTimeout(checkAPIStatus, 5000);
    }
}

// Initialize Event Listeners
function initializeEventListeners() {
    hamburger?.addEventListener('click', () => {
        navMenu.classList.toggle('active');
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.dataset.tab;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            item.classList.toggle('active');
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
        });
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}

// Single Video Download Functions
async function analyzeVideo() {
    const urlInput = document.getElementById('singleUrl');
    const url = urlInput.value.trim();
    
    if (!url) {
        showNotification('Please enter a YouTube URL', 'error');
        return;
    }
    
    if (!isValidYouTubeUrl(url)) {
        showNotification('Please enter a valid YouTube URL', 'error');
        return;
    }
    
    showProgress('Analyzing video...');
    
    try {
        const response = await fetch(`${API_URL}/api/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch video info');
        }
        
        hideProgress();
        currentVideoData = { url: url, ...data };
        displayVideoInfo(data);
        showNotification('✅ Video analyzed successfully!', 'success');
    } catch (error) {
        hideProgress();
        console.error('Error:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

function displayVideoInfo(data) {
    const videoInfo = document.getElementById('videoInfo');
    videoInfo.style.display = 'block';
    
    document.getElementById('videoThumbnail').src = data.thumbnail;
    document.getElementById('videoTitle').textContent = data.title;
    document.getElementById('videoDuration').textContent = `Duration: ${formatDuration(data.duration)}`;
    document.getElementById('videoAuthor').textContent = `Author: ${data.author}`;
    document.getElementById('videoViews').textContent = `Views: ${formatNumber(data.viewCount)}`;
    
    const qualityOptions = document.getElementById('qualityOptions');
    qualityOptions.innerHTML = '';
    
    if (data.formats && data.formats.length > 0) {
        data.formats.forEach((format, index) => {
            const option = document.createElement('div');
            option.className = 'quality-option';
            option.innerHTML = `
                <input type="radio" name="quality" id="quality${index}" value="${format.itag}" ${index === 0 ? 'checked' : ''}>
                <label for="quality${index}" class="quality-label">
                    <i class="fas fa-video"></i>
                    <div>
                        <div>${format.quality}</div>
                        <small>${format.size}</small>
                    </div>
                </label>
            `;
            qualityOptions.appendChild(option);
        });
    }
}

function downloadVideo() {
    if (!currentVideoData) {
        showNotification('Please analyze a video first', 'error');
        return;
    }
    
    const selectedQuality = document.querySelector('input[name="quality"]:checked');
    const itag = selectedQuality ? selectedQuality.value : '';
    
    showProgress('Preparing download...');
    
    const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(currentVideoData.url)}&itag=${itag}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${currentVideoData.title}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        hideProgress();
        showNotification('✅ Download started! Check your downloads folder.', 'success');
    }, 1000);
}

// Batch Download Functions
async function analyzeBatch() {
    const textarea = document.getElementById('batchUrls');
    const urls = textarea.value.split('\n').filter(url => url.trim());
    
    if (urls.length === 0) {
        showNotification('Please enter at least one URL', 'error');
        return;
    }
    
    if (urls.length > 10) {
        showNotification('Maximum 10 videos allowed in batch', 'error');
        return;
    }
    
    batchVideos = [];
    const batchList = document.getElementById('batchList');
    batchList.innerHTML = '';
    batchList.style.display = 'block';
    
    for (const url of urls) {
        if (!isValidYouTubeUrl(url)) {
            batchVideos.push({ url, status: 'error', error: 'Invalid URL' });
            continue;
        }
        
        try {
            const response = await fetch(`${API_URL}/api/info`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (data.success) {
                batchVideos.push({ url, status: 'ready', data });
            } else {
                batchVideos.push({ url, status: 'error', error: data.error });
            }
        } catch (error) {
            batchVideos.push({ url, status: 'error', error: error.message });
        }
    }
    
    displayBatchList();
    document.getElementById('batchSettings').style.display = 'block';
}

function displayBatchList() {
    const batchList = document.getElementById('batchList');
    batchList.innerHTML = '';
    
    batchVideos.forEach((video, index) => {
        const item = document.createElement('div');
        item.className = 'batch-item';
        item.innerHTML = `
            <div class="batch-item-info">
                <span>#${index + 1}</span>
                <span>${video.data ? video.data.title : video.url}</span>
            </div>
            <span class="batch-item-status status-${video.status}">${video.status}</span>
        `;
        batchList.appendChild(item);
    });
}

function clearBatch() {
    document.getElementById('batchUrls').value = '';
    document.getElementById('batchList').style.display = 'none';
    document.getElementById('batchSettings').style.display = 'none';
    batchVideos = [];
}

function downloadBatch() {
    const readyVideos = batchVideos.filter(v => v.status === 'ready');
    
    if (readyVideos.length === 0) {
        showNotification('No videos ready for download', 'error');
        return;
    }
    
    showNotification(`Starting download of ${readyVideos.length} videos...`, 'info');
    
    readyVideos.forEach((video, index) => {
        setTimeout(() => {
            const downloadUrl = `${API_URL}/api/download?url=${encodeURIComponent(video.url)}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `${video.data.title}.mp4`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }, index * 1000);
    });
}

// Audio Extractor Functions
async function analyzeAudio() {
    const urlInput = document.getElementById('audioUrlInput');
    const url = urlInput.value.trim();
    
    if (!url) {
        showNotification('Please enter a YouTube URL', 'error');
        return;
    }
    
    if (!isValidYouTubeUrl(url)) {
        showNotification('Please enter a valid YouTube URL', 'error');
        return;
    }
    
    showProgress('Analyzing audio...');
    
    try {
        const response = await fetch(`${API_URL}/api/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch audio info');
        }
        
        hideProgress();
        currentAudioData = { url: url, ...data };
        displayAudioInfo(data);
        showNotification('✅ Audio analyzed successfully!', 'success');
    } catch (error) {
        hideProgress();
        console.error('Error:', error);
        showNotification(`❌ Error: ${error.message}`, 'error');
    }
}

function displayAudioInfo(data) {
    const audioInfo = document.getElementById('audioInfo');
    audioInfo.style.display = 'block';
    
    document.getElementById('audioThumbnail').src = data.thumbnail;
    document.getElementById('audioTitle').textContent = data.title;
    document.getElementById('audioDuration').textContent = `Duration: ${formatDuration(data.duration)}`;
}

function extractAudio() {
    if (!currentAudioData) {
        showNotification('Please analyze a video first', 'error');
        return;
    }
    
    const bitrate = document.getElementById('audioBitrate').value;
    
    showProgress('Extracting audio...');
    
    const downloadUrl = `${API_URL}/api/audio?url=${encodeURIComponent(currentAudioData.url)}&quality=${bitrate}`;
    
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${currentAudioData.title}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
        hideProgress();
        showNotification('✅ Audio extraction started!', 'success');
    }, 1000);
}

// Utility Functions
function isValidYouTubeUrl(url) {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
    return pattern.test(url);
}

function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

function showProgress(message) {
    progressModal.classList.add('show');
    document.querySelector('.progress-status').textContent = message;
}

function hideProgress() {
    progressModal.classList.remove('show');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas ${icons[type]}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}
