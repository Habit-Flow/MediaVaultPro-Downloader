const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'MediaVault Pro API is running!',
        version: '2.0.0',
        engine: 'yt-dlp',
        endpoints: {
            health: 'GET /health',
            info: 'POST /api/info',
            download: 'GET /api/download',
            audio: 'GET /api/audio'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Get video info
app.post('/api/info', async (req, res) => {
    try {
        const { url } = req.body;
        
        if (!url || !url.includes('youtube.com') && !url.includes('youtu.be')) {
            return res.status(400).json({ 
                success: false,
                error: 'Invalid YouTube URL' 
            });
        }
        
        console.log('Fetching info for:', url);
        
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true
        });
        
        // Get available formats
        const formats = info.formats
            .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
            .map(f => ({
                quality: f.format_note || f.height + 'p' || 'Unknown',
                itag: f.format_id,
                container: f.ext,
                size: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(2) + ' MB' : 'Unknown'
            }))
            .slice(0, 5);
        
        const videoDetails = {
            success: true,
            title: info.title,
            duration: info.duration,
            thumbnail: info.thumbnail,
            author: info.uploader || info.channel,
            videoId: info.id,
            description: (info.description || '').substring(0, 200),
            viewCount: info.view_count?.toString() || '0',
            formats: formats
        };
        
        res.json(videoDetails);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch video information',
            message: error.message 
        });
    }
});

// Download video
app.get('/api/download', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false,
                error: 'URL is required' 
            });
        }
        
        console.log('Download request:', url);
        
        const info = await youtubedl(url, {
            dumpSingleJson: true
        });
        
        const title = info.title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
        
        res.header('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.header('Content-Type', 'video/mp4');
        
        const stream = await youtubedl.exec(url, {
            output: '-',
            format: 'best[ext=mp4]/best'
        });
        
        stream.pipe(res);
            
    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: 'Download failed',
                message: error.message 
            });
        }
    }
});

// Download audio
app.get('/api/audio', async (req, res) => {
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ 
                success: false,
                error: 'URL is required' 
            });
        }
        
        console.log('Audio extraction:', url);
        
        const info = await youtubedl(url, {
            dumpSingleJson: true
        });
        
        const title = info.title.replace(/[^\w\s]/gi, '').replace(/\s+/g, '_');
        
        res.header('Content-Disposition', `attachment; filename="${title}.mp3"`);
        res.header('Content-Type', 'audio/mpeg');
        
        const stream = await youtubedl.exec(url, {
            output: '-',
            extractAudio: true,
            audioFormat: 'mp3',
            audioQuality: 0
        });
        
        stream.pipe(res);
        
    } catch (error) {
        console.error('Audio error:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                success: false,
                error: 'Audio extraction failed',
                message: error.message 
            });
        }
    }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ MediaVault Pro server running on port ${PORT}`);
    console.log(`🌐 API ready with yt-dlp engine`);
});
