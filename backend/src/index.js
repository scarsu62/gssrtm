import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import {
  initDb,
  getProjects,
  getProject,
  createProject,
  deleteProject,
  getRequirements,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  bulkCreateRequirements,
  getFunctions,
  createFunction,
  updateFunction,
  deleteFunction,
  bulkCreateFunctions,
  getMappings,
  createMapping,
  updateMapping,
  deleteMapping,
  bulkCreateMappings,
  deleteMappingByReqAndFun,
} from './db.js';

import { parseDocx, parseXlsx, xlsxToText, tryExtractStructuredRows } from './parser.js';
import { deconstructRequirements, deconstructFunctions, alignTraceability } from './ai.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & JSON parsing
app.use(cors());
app.use(express.json());

// Setup Multer for file uploads
const uploadDir = path.join(__dirname, '..', 'uploads');
await fs.mkdir(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

// Helper to get API Key from Headers or Env with debugging
function getApiKey(req) {
  const key = req.headers['x-gemini-key'] || process.env.GEMINI_API_KEY || '';
  if (key) {
    const cleanKey = key.trim();
    const masked = cleanKey.substring(0, 6) + '...' + (cleanKey.length > 10 ? cleanKey.substring(cleanKey.length - 4) : '');
    console.log(`[API Key Debug] Key: ${masked}, Raw Length: ${key.length}, Clean Length: ${cleanKey.length}`);
    return cleanKey;
  }
  console.log('[API Key Debug] No key found in request headers or process environment');
  return '';
}

// === API ROUTES ===

// 1. Projects
app.get('/api/projects', async (req, res) => {
  try {
    const list = await getProjects();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await getProject(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const project = await createProject({ name, description });
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', async (req, res) => {
  try {
    await deleteProject(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Requirements (Get, Manual Add, Edit, Delete)
app.get('/api/projects/:projectId/requirements', async (req, res) => {
  try {
    const list = await getRequirements(req.params.projectId);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/requirements', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { code, name, description } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Code and Name are required' });
    const reqItem = await createRequirement({ projectId, code, name, description, status: 'new' });
    res.status(201).json(reqItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:projectId/requirements/:id', async (req, res) => {
  try {
    const { id, projectId } = req.params;
    const { code, name, description, status } = req.body;
    
    // Check if description/name changed to raise warnings on mappings
    const currentList = await getRequirements(projectId);
    const existing = currentList.find(r => r.id === id);
    let updatedStatus = status || existing.status;
    
    if (existing && (existing.name !== name || existing.description !== description)) {
      updatedStatus = 'modified';
      // Mark all mappings for this requirement as "pending"
      const mappings = await getMappings(projectId);
      const affectedMappings = mappings.filter(m => m.requirementId === id);
      for (const m of affectedMappings) {
        await updateMapping(m.id, { status: 'pending' });
      }
    }
    
    const updated = await updateRequirement(id, { code, name, description, status: updatedStatus });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:projectId/requirements/:id', async (req, res) => {
  try {
    const { id, projectId } = req.params;
    
    // Mark as deleted instead of actual purge if preferred, or delete and mark associated mappings as pending
    // Let's perform a physical delete of requirement and clean up its mappings
    await deleteRequirement(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Import Requirements (Word / Excel) with Diff Logic
app.post('/api/projects/:projectId/requirements/import', upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const file = req.file;
    const useAI = req.body.useAI === 'true';
    const apiKey = getApiKey(req);
    const model = req.body.model || 'gemini-3.5-flash';
    
    console.log(`[Import Requirements] Request received for project ${projectId}`);
    if (!file) {
      console.warn('[Import Requirements] No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`[Import Requirements] File: ${file.originalname}, Size: ${file.size} bytes, Ext: ${path.extname(file.originalname)}`);
    console.log(`[Import Requirements] Config - useAI: ${useAI}, Model: ${model}, API Key provided: ${!!apiKey}`);

    let parsedText = '';
    let parsedList = null;
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ext === '.docx') {
      parsedText = await parseDocx(file.path);
    } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      const sheetsData = await parseXlsx(file.path);
      // Attempt Excel structure parsing first
      if (!useAI) {
        parsedList = tryExtractStructuredRows(sheetsData);
        console.log(`[Import Requirements] Structured excel parsing returned: ${parsedList ? parsedList.length + ' items' : 'null'}`);
      }
      parsedText = xlsxToText(sheetsData);
    } else if (ext === '.txt') {
      parsedText = await fs.readFile(file.path, 'utf-8');
    } else {
      console.warn(`[Import Requirements] Unsupported format: ${ext}`);
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    
    console.log(`[Import Requirements] Parsed raw text length: ${parsedText ? parsedText.length : 0} characters`);

    // Clean up uploaded file
    await fs.unlink(file.path);
    
    // If we didn't parse structured rows directly, or user requested AI deconstruction
    if (!parsedList && parsedText) {
      if (!apiKey && useAI) {
        console.warn('[Import Requirements] API Key is missing for AI parsing');
        return res.status(400).json({ error: 'Gemini API Key is missing. Add it in settings or disable AI parsing.' });
      }
      if (useAI) {
        console.log('[Import Requirements] Invoking Gemini API for requirement deconstruction...');
        parsedList = await deconstructRequirements(parsedText, apiKey, model);
        console.log(`[Import Requirements] Gemini returned ${parsedList ? parsedList.length : 0} structured requirements`);
      } else {
        // Simple fallback parser (e.g., split lines)
        console.log('[Import Requirements] Using non-AI fallback parser...');
        parsedList = parsedText
          .split('\n')
          .map((line, idx) => line.trim())
          .filter(line => line.length > 5)
          .map((line, idx) => ({
            code: `REQ-${String(idx + 1).padStart(3, '0')}`,
            name: line.substring(0, 20) + (line.length > 20 ? '...' : ''),
            description: line,
          }));
        console.log(`[Import Requirements] Fallback parser returned ${parsedList.length} items`);
      }
    }
    
    if (!parsedList || parsedList.length === 0) {
      console.warn('[Import Requirements] Resulting parsedList is empty or null, returning 422');
      return res.status(422).json({ error: 'Could not extract requirements from the document.' });
    }
    
    // === Diffing Logic ===
    const existingReqs = await getRequirements(projectId);
    const existingMap = new Map(existingReqs.map(r => [r.code, r]));
    const importedCodes = new Set(parsedList.map(r => r.code));
    
    const toCreate = [];
    const toUpdate = [];
    const unchangedIds = new Set();
    
    // Process imported list
    for (const item of parsedList) {
      const existing = existingMap.get(item.code);
      if (!existing) {
        // New item
        toCreate.push({
          code: item.code,
          name: item.name,
          description: item.description,
          status: 'new',
          version: '1.0.0',
        });
      } else {
        // Compare contents
        const hasChanged = existing.name !== item.name || existing.description !== item.description;
        if (hasChanged) {
          // Increment minor version, mark status
          const currentVer = existing.version || '1.0.0';
          const verParts = currentVer.split('.');
          if (verParts.length === 3) {
            verParts[1] = String(Number(verParts[1]) + 1); // increment minor version e.g. 1.1.0
            verParts[2] = '0';
          }
          const nextVersion = verParts.join('.');
          
          toUpdate.push({
            id: existing.id,
            updates: {
              name: item.name,
              description: item.description,
              status: 'modified',
              version: nextVersion,
            },
            triggerWarning: true,
          });
        } else {
          // Mark as unchanged, keep current state
          unchangedIds.add(existing.id);
          if (existing.status !== 'unchanged') {
            toUpdate.push({
              id: existing.id,
              updates: { status: 'unchanged' },
              triggerWarning: false,
            });
          }
        }
      }
    }
    
    // Identify deleted requirements (exist in DB but missing in import)
    const toDeleteIds = [];
    for (const exReq of existingReqs) {
      if (!importedCodes.has(exReq.code)) {
        toUpdate.push({
          id: exReq.id,
          updates: { status: 'deleted' },
          triggerWarning: true,
        });
      }
    }
    
    // Apply changes to database
    const createdItems = await bulkCreateRequirements(projectId, toCreate);
    
    for (const updateObj of toUpdate) {
      await updateRequirement(updateObj.id, updateObj.updates);
      if (updateObj.triggerWarning) {
        // Mark all associated mappings as 'pending' for modified or deleted requirements
        const mappings = await getMappings(projectId);
        const affected = mappings.filter(m => m.requirementId === updateObj.id);
        for (const m of affected) {
          await updateMapping(m.id, { status: 'pending' });
        }
      }
    }
    
    res.json({
      success: true,
      summary: {
        totalImported: parsedList.length,
        created: toCreate.length,
        updated: toUpdate.filter(u => u.updates.status === 'modified').length,
        deleted: toUpdate.filter(u => u.updates.status === 'deleted').length,
        unchanged: unchangedIds.size,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 4. Functions (Get, Manual Add, Edit, Delete)
app.get('/api/projects/:projectId/functions', async (req, res) => {
  try {
    const list = await getFunctions(req.params.projectId);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/functions', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { code, name, description } = req.body;
    if (!name || !code) return res.status(400).json({ error: 'Code and Name are required' });
    const funcItem = await createFunction({ projectId, code, name, description, status: 'new' });
    res.status(201).json(funcItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:projectId/functions/:id', async (req, res) => {
  try {
    const { id, projectId } = req.params;
    const { code, name, description, status } = req.body;
    
    const currentList = await getFunctions(projectId);
    const existing = currentList.find(f => f.id === id);
    let updatedStatus = status || existing.status;
    
    if (existing && (existing.name !== name || existing.description !== description)) {
      updatedStatus = 'modified';
      // Mark all mappings for this function as "pending"
      const mappings = await getMappings(projectId);
      const affectedMappings = mappings.filter(m => m.functionId === id);
      for (const m of affectedMappings) {
        await updateMapping(m.id, { status: 'pending' });
      }
    }
    
    const updated = await updateFunction(id, { code, name, description, status: updatedStatus });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:projectId/functions/:id', async (req, res) => {
  try {
    const { id, projectId } = req.params;
    await deleteFunction(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Import Functions (Word / Excel) with Diff Logic
app.post('/api/projects/:projectId/functions/import', upload.single('file'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const file = req.file;
    const useAI = req.body.useAI === 'true';
    const apiKey = getApiKey(req);
    const model = req.body.model || 'gemini-3.5-flash';
    
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    
    let parsedText = '';
    let parsedList = null;
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (ext === '.docx') {
      parsedText = await parseDocx(file.path);
    } else if (ext === '.xlsx' || ext === '.xls' || ext === '.csv') {
      const sheetsData = await parseXlsx(file.path);
      if (!useAI) {
        parsedList = tryExtractStructuredRows(sheetsData);
      }
      parsedText = xlsxToText(sheetsData);
    } else if (ext === '.txt') {
      parsedText = await fs.readFile(file.path, 'utf-8');
    } else {
      return res.status(400).json({ error: 'Unsupported file format' });
    }
    
    await fs.unlink(file.path);
    
    if (!parsedList && parsedText) {
      if (!apiKey && useAI) {
        return res.status(400).json({ error: 'Gemini API Key is missing. Add it in settings or disable AI parsing.' });
      }
      if (useAI) {
        parsedList = await deconstructFunctions(parsedText, apiKey, model);
      } else {
        parsedList = parsedText
          .split('\n')
          .map((line, idx) => line.trim())
          .filter(line => line.length > 5)
          .map((line, idx) => ({
            code: `FUN-${String(idx + 1).padStart(3, '0')}`,
            name: line.substring(0, 20) + (line.length > 20 ? '...' : ''),
            description: line,
          }));
      }
    }
    
    if (!parsedList || parsedList.length === 0) {
      return res.status(422).json({ error: 'Could not extract functions from the document.' });
    }
    
    // === Diffing Logic ===
    const existingFuncs = await getFunctions(projectId);
    const existingMap = new Map(existingFuncs.map(f => [f.code, f]));
    const importedCodes = new Set(parsedList.map(f => f.code));
    
    const toCreate = [];
    const toUpdate = [];
    const unchangedIds = new Set();
    
    for (const item of parsedList) {
      const existing = existingMap.get(item.code);
      if (!existing) {
        toCreate.push({
          code: item.code,
          name: item.name,
          description: item.description,
          status: 'new',
          version: '1.0.0',
        });
      } else {
        const hasChanged = existing.name !== item.name || existing.description !== item.description;
        if (hasChanged) {
          const currentVer = existing.version || '1.0.0';
          const verParts = currentVer.split('.');
          if (verParts.length === 3) {
            verParts[1] = String(Number(verParts[1]) + 1);
            verParts[2] = '0';
          }
          const nextVersion = verParts.join('.');
          
          toUpdate.push({
            id: existing.id,
            updates: {
              name: item.name,
              description: item.description,
              status: 'modified',
              version: nextVersion,
            },
            triggerWarning: true,
          });
        } else {
          unchangedIds.add(existing.id);
          if (existing.status !== 'unchanged') {
            toUpdate.push({
              id: existing.id,
              updates: { status: 'unchanged' },
              triggerWarning: false,
            });
          }
        }
      }
    }
    
    for (const exFunc of existingFuncs) {
      if (!importedCodes.has(exFunc.code)) {
        toUpdate.push({
          id: exFunc.id,
          updates: { status: 'deleted' },
          triggerWarning: true,
        });
      }
    }
    
    await bulkCreateFunctions(projectId, toCreate);
    
    for (const updateObj of toUpdate) {
      await updateFunction(updateObj.id, updateObj.updates);
      if (updateObj.triggerWarning) {
        const mappings = await getMappings(projectId);
        const affected = mappings.filter(m => m.functionId === updateObj.id);
        for (const m of affected) {
          await updateMapping(m.id, { status: 'pending' });
        }
      }
    }
    
    res.json({
      success: true,
      summary: {
        totalImported: parsedList.length,
        created: toCreate.length,
        updated: toUpdate.filter(u => u.updates.status === 'modified').length,
        deleted: toUpdate.filter(u => u.updates.status === 'deleted').length,
        unchanged: unchangedIds.size,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Traceability Mappings (Get, Toggle, Confirm, Run AI Alignment)
app.get('/api/projects/:projectId/mappings', async (req, res) => {
  try {
    const list = await getMappings(req.params.projectId);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle a specific mapping link manually (from UI matrix)
app.post('/api/projects/:projectId/mappings/toggle', async (req, res) => {
  try {
    const { projectId } = req.params;
    const { requirementId, functionId, active } = req.body;
    
    if (!requirementId || !functionId) {
      return res.status(400).json({ error: 'requirementId and functionId are required' });
    }
    
    if (active) {
      // Create or update mapping to confirmed
      const m = await createMapping({
        projectId,
        requirementId,
        functionId,
        status: 'confirmed',
        confidence: 1.0,
        reason: '手動建立關聯',
      });
      res.json(m);
    } else {
      // Delete mapping
      await deleteMappingByReqAndFun(projectId, requirementId, functionId);
      res.json({ success: true, deleted: true });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update specific mapping status (e.g. confirming an AI mapping or resetting pending warning)
app.put('/api/projects/:projectId/mappings/:mappingId', async (req, res) => {
  try {
    const { mappingId } = req.params;
    const { status, reason } = req.body;
    
    const updated = await updateMapping(mappingId, { status, reason });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger Gemini to align requirements and functions automatically
app.post('/api/projects/:projectId/mappings/ai-align', async (req, res) => {
  try {
    const { projectId } = req.params;
    const apiKey = getApiKey(req);
    const model = req.body.model || 'gemini-3.5-flash';
    const singleReqId = req.body.requirementId; // Optional: align only one requirement
    
    if (!apiKey) {
      return res.status(400).json({ error: 'Gemini API Key is missing. Configure it in Settings.' });
    }
    
    let requirements = await getRequirements(projectId);
    // Ignore deleted requirements in alignment
    requirements = requirements.filter(r => r.status !== 'deleted');
    
    if (singleReqId) {
      requirements = requirements.filter(r => r.id === singleReqId);
    }
    
    const functions = (await getFunctions(projectId)).filter(f => f.status !== 'deleted');
    
    if (requirements.length === 0 || functions.length === 0) {
      return res.status(400).json({ error: 'Cannot run alignment: Need at least one requirement and one function.' });
    }
    
    // Map list to simpler array for prompt to save tokens
    const reqPromptList = requirements.map(r => ({ code: r.code, name: r.name, description: r.description }));
    const funPromptList = functions.map(f => ({ code: f.code, name: f.name, description: f.description }));
    
    // Call AI
    const rawAiMappings = await alignTraceability(reqPromptList, funPromptList, apiKey, model);
    
    // Maps of code -> ID
    const reqCodeMap = new Map(requirements.map(r => [r.code, r.id]));
    const funCodeMap = new Map(functions.map(f => [f.code, f.id]));
    
    const mappingsToSave = [];
    for (const aim of rawAiMappings) {
      const reqId = reqCodeMap.get(aim.requirementCode);
      const funId = funCodeMap.get(aim.functionCode);
      
      if (reqId && funId) {
        mappingsToSave.push({
          requirementId: reqId,
          functionId: funId,
          status: 'ai_recommended',
          confidence: Number(aim.confidence || 0.8),
          reason: aim.reason || 'AI 自動對齊推薦',
        });
      }
    }
    
    const saved = await bulkCreateMappings(projectId, mappingsToSave);
    
    // If aligning single requirement, return mapping details directly
    res.json({
      success: true,
      totalRecommended: saved.length,
      recommended: saved,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, async () => {
  try {
    await initDb();
    console.log(`RTM Database loaded. Backend server listening on http://localhost:${PORT}`);
  } catch (err) {
    console.error('Server initialization error:', err);
  }
});
