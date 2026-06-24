const express = require('express');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');
const multer = require('multer');

// SAFE STARTUP WRAPPER
process.on('uncaughtException', (err) => {
    console.log('!!! CRITICAL SYSTEM CRASH:');
    console.error(err);
});

const app = express();
const PORT = 3001;

// CORE OVERRIDE: Capacity definitions kept at 100mb safety ceilings
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- STORAGE CONFIG ---
// Fallback to the universally writable /tmp directory if no env var is set
const ARCHIVE_DIR = process.env.ARCHIVE_DIR || path.join('/tmp', 'wir_archive');
const UPLOADS_DIR = path.join(ARCHIVE_DIR, 'uploads'); 
const DRAFT_FILE = path.join(ARCHIVE_DIR, 'current_weekly_draft.json');
const AUDIT_FILE = path.join(ARCHIVE_DIR, 'audit_log.json');

if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// --- MULTER STORAGE ENGINE ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `wir_upload_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

// --- AUDIT LOG ENGINE ---
const addAuditEntry = (action, details) => {
    let logs = [];
    if (fs.existsSync(AUDIT_FILE)) {
        try { 
            logs = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')); 
        } catch(e) {
            logs = [];
        }
    }
    const entry = {
        timestamp: new Date().toISOString(),
        action: action,
        details: details
    };
    logs.unshift(entry);
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs.slice(0, 100), null, 2));
};

// MIDDLEWARE: APP LOGGING
app.use((req, res, next) => {
    if (req.url.startsWith('/api') || req.url === '/') {
        console.log(`>>> [APP LOG] ${new Date().toISOString()} | ${req.method} ${req.url}`);
    }
    next();
});

// CORE LOGIC: COLLECTOR RUNNER
const runCollector = (scriptName, res) => {
    const scriptPath = path.join(__dirname, 'collectors', scriptName);
    if (!fs.existsSync(scriptPath)) {
        console.log(`!! [ERROR] SCRIPT MISSING: ${scriptPath}`);
        return res.status(404).json({ error: "Script not found" });
    }

    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.log(`!! [EXEC ERROR] ${scriptName}: ${stderr || error.message}`);
            return res.status(500).json({ error: stderr || "Python execution failed" });
        }
        console.log(`>>> [RAW_CAPTURE] ${scriptName} SUCCESS. Payload length: ${stdout.length}`);
        try {
            const data = JSON.parse(stdout);
            res.json(data);
        } catch (e) {
            console.log(`!! [JSON ERROR] ${scriptName} output was not JSON: ${stdout}`);
            res.status(500).json({ error: "Collector returned invalid JSON" });
        }
    });
};

// --- API ROUTES ---

// FIX: Parameter signature normalized to (req, res) to resolve 'res.json is not a function' loop
app.post('/api/upload-image', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded resource provided." });
    }
    const relativeUrl = `/api/uploads/${req.file.filename}`;
    console.log(`>>> [BINARY CAPTURE] Asset stored successfully: ${req.file.filename} (${req.file.size} bytes)`);
    res.json({ url: relativeUrl });
});

app.get('/api/audit-logs', (req, res) => {
    if (fs.existsSync(AUDIT_FILE)) {
        res.json(JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8')));
    } else {
        res.json([]);
    }
});

app.get('/api/draft', (req, res) => {
    if (fs.existsSync(DRAFT_FILE)) {
        const data = fs.readFileSync(DRAFT_FILE, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json({});
    }
});

app.post('/api/draft', (req, res) => {
    const isManual = req.body.isManual;
    const dataToWrite = req.body.payload || req.body;
    
    try {
        fs.writeFileSync(DRAFT_FILE, JSON.stringify(dataToWrite, null, 2));
        if (isManual) {
            addAuditEntry("MANUAL_SAVE", `Saved draft to current_weekly_draft.json`);
        }
        res.json({ message: "Draft saved successfully", filename: "current_weekly_draft.json" });
    } catch (err) {
        console.log(`!! [WRITE ERROR]: ${err.message}`);
        res.status(500).json({ error: "Failed to write draft" });
    }
});

app.get('/api/archives', (req, res) => {
    try {
        const files = fs.readdirSync(ARCHIVE_DIR)
            .filter(f => f.endsWith('.json') && !f.includes('current_weekly_draft') && !f.includes('audit_log'))
            .map(f => ({ 
                name: f, 
                time: fs.statSync(path.join(ARCHIVE_DIR, f)).mtime 
            }));
        res.json(files.sort((a, b) => b.time - a.time));
    } catch (err) {
        res.status(500).json({ error: "Failed to read archives" });
    }
});

app.post('/api/archive-current', (req, res) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `WiR_Final_${timestamp}.json`;
    if (fs.existsSync(DRAFT_FILE)) {
        fs.renameSync(DRAFT_FILE, path.join(ARCHIVE_DIR, archiveName));
        addAuditEntry("FINALIZE_WEEK", `Archived current week to ${archiveName}`);
        res.json({ message: "Report finalized", filename: archiveName });
    } else {
        res.status(404).json({ error: "No active draft found to archive" });
    }
});

app.post('/api/load-archive', (req, res) => {
    const source = path.join(ARCHIVE_DIR, req.body.filename);
    if (fs.existsSync(source)) {
        const data = fs.readFileSync(source, 'utf8');
        fs.writeFileSync(DRAFT_FILE, data);
        addAuditEntry("RESTORE_ARCHIVE", `Restored ${req.body.filename} to active workspace`);
        res.json({ message: "Archive restored to active workspace" });
    } else {
        res.status(404).json({ error: "Archive file not found" });
    }
});

app.post('/api/rename-archive', (req, res) => {
    const { oldName, newName } = req.body;
    const oldPath = path.join(ARCHIVE_DIR, oldName);
    const cleanNew = newName.endsWith('.json') ? newName : `${newName}.json`;
    const newPath = path.join(ARCHIVE_DIR, cleanNew);
    
    if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
        addAuditEntry("RENAME_FILE", `Renamed ${oldName} to ${cleanNew}`);
        res.json({ message: "File renamed successfully" });
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

app.get('/api/download-archive/:filename', (req, res) => {
    const target = path.join(ARCHIVE_DIR, req.params.filename);
    if (fs.existsSync(target)) {
        addAuditEntry("DOWNLOAD_FILE", `Downloaded ${req.params.filename}`);
        res.download(target);
    } else {
        res.status(404).send("File not found");
    }
});

app.delete('/api/archive/:filename', (req, res) => {
    const target = path.join(ARCHIVE_DIR, req.params.filename);
    if (fs.existsSync(target)) {
        fs.unlinkSync(target);
        addAuditEntry("DELETE_FILE", `Deleted ${req.params.filename} from Vault`);
        res.json({ message: "Archive deleted" });
    } else {
        res.status(404).json({ error: "File not found" });
    }
});

app.post('/api/log-action', (req, res) => {
    addAuditEntry(req.body.action, req.body.details);
    res.json({ status: "logged" });
});

app.get('/api/metrics/:collector', (req, res) => {
    const scriptMapping = {
        'network':      'get_wug_network.py',
        'servers':      'get_govc_servers.py',
        'storage':      'get_host_storage.py',
        'backups':      'get_veeam_backups.py',
        'workstations': 'get_s1_threats.py',
        'tickets':      'get_tdx_tickets.py',
        'meraki':       'get_meraki_metrics.py',
        'tenable':      'get_tenable_metrics.py',
        'duo':          'get_duo_metrics.py',
        'varonis':      'get_varonis_metrics.py',
        'palo':         'get_palo_metrics.py',
        'kb4':          'get_kb4_metrics.py',
        'exchange':     'get_exchange_metrics.py'
    };
    const script = scriptMapping[req.params.collector];
    if (!script) return res.status(404).json({ error: "Unknown collector" });
    runCollector(script, res);
});

// --- STATIC ASSETS ---
app.use('/api/uploads', express.static(UPLOADS_DIR)); 
app.use('/wir', express.static(path.join(__dirname, 'dist')));

// --- CATCH-ALLS ---
app.get(/^\/wir\/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.get('/', (req, res) => {
    res.redirect('/wir/');
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
    console.log('------------------------------------------');
    console.log(`WiR BUiLDER-PRO v0.0.69 - COLLABORATION MODE ACTIVE`);
    console.log(`Listening on: Port ${PORT}`);
    console.log('------------------------------------------');
});