import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WorkflowStatus, UserRole } from './src/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
console.log(`Uploads directory: ${uploadsDir}`);
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({ storage });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);
const PORT = 3000;

// Database Setup
const db = new Database('npd_workflow.db');

// Initialize Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS workflow_items (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    created_by TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    data TEXT NOT NULL
  );
`);

app.use(express.json());

// Explicitly serve uploads - MOVED TO TOP and made more robust
app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, filename);
  
  console.log(`Serving file: ${filename} from ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    // Force PDF content type for PDF files
    if (filename.toLowerCase().endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
    res.sendFile(filePath);
  } else {
    console.error(`File not found: ${filePath}`);
    res.status(404).json({ error: 'File not found' });
  }
});

// Debug route to list uploads
app.get('/api/debug/uploads', (req, res) => {
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    res.json({ uploadsDir, files });
  } else {
    res.status(404).json({ error: 'Uploads directory not found', uploadsDir });
  }
});

// API Routes
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      console.error('Upload attempt with no file');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log(`File uploaded successfully: ${req.file.filename}`);
    res.json({ 
      url: `/uploads/${req.file.filename}`,
      filename: req.file.originalname 
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Internal server error during upload' });
  }
});

app.get('/api/workflow', (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM workflow_items ORDER BY updated_at DESC').all();
    res.json(items.map((item: any) => ({
      ...item,
      data: JSON.parse(item.data)
    })));
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

app.get('/api/workflow/:id', (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM workflow_items WHERE id = ?').get(req.params.id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json({
      ...item,
      data: JSON.parse(item.data)
    });
  } catch (err) {
    console.error('Fetch detail error:', err);
    res.status(500).json({ error: 'Failed to fetch workflow details' });
  }
});

app.post('/api/workflow', (req, res) => {
  try {
    const { id, status, createdBy, data } = req.body;
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO workflow_items (id, status, created_by, created_at, updated_at, data)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, status, createdBy, now, now, JSON.stringify(data));
    
    io.emit('workflow_updated', { id, status });
    res.json({ success: true });
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

app.put('/api/workflow/:id', (req, res) => {
  try {
    const { status, data } = req.body;
    const now = Date.now();
    
    db.prepare(`
      UPDATE workflow_items 
      SET status = ?, updated_at = ?, data = ?
      WHERE id = ?
    `).run(status, now, JSON.stringify(data), req.params.id);
    
    io.emit('workflow_updated', { id: req.params.id, status });
    res.json({ success: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Socket.io
io.on('connection', (socket) => {
  console.log('Client connected');
  socket.on('disconnect', () => console.log('Client disconnected'));
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('-------------------------------------------');
    console.log(`NPD Workflow Manager is running!`);
    console.log(`Local:            http://localhost:${PORT}`);
    
    // Attempt to show network IP
    import('os').then(os => {
      const interfaces = os.networkInterfaces();
      for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
          if (iface.family === 'IPv4' && !iface.internal) {
            console.log(`On Your Network:  http://${iface.address}:${PORT}`);
          }
        }
      }
      console.log('-------------------------------------------');
    });
  });
}

startServer();
