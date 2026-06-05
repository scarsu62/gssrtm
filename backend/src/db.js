import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');

// Table list
const TABLES = {
  projects: 'projects.json',
  requirements: 'requirements.json',
  functions: 'functions.json',
  mappings: 'mappings.json',
};

export async function initDb() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    for (const [key, filename] of Object.entries(TABLES)) {
      const filepath = path.join(DATA_DIR, filename);
      try {
        await fs.access(filepath);
      } catch {
        // File does not exist, initialize with empty array
        await fs.writeFile(filepath, JSON.stringify([], null, 2), 'utf-8');
      }
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

async function readTable(table) {
  const filepath = path.join(DATA_DIR, TABLES[table]);
  const data = await fs.readFile(filepath, 'utf-8');
  return JSON.parse(data);
}

async function writeTable(table, data) {
  const filepath = path.join(DATA_DIR, TABLES[table]);
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
}

// === Project APIs ===
export async function getProjects() {
  return await readTable('projects');
}

export async function getProject(id) {
  const list = await readTable('projects');
  return list.find((p) => p.id === id) || null;
}

export async function createProject({ name, description }) {
  const list = await readTable('projects');
  const project = {
    id: uuidv4(),
    name,
    description: description || '',
    createdAt: new Date().toISOString(),
  };
  list.push(project);
  await writeTable('projects', list);
  return project;
}

export async function deleteProject(id) {
  // Delete project
  const projects = await readTable('projects');
  await writeTable('projects', projects.filter((p) => p.id !== id));

  // Cascade delete requirements, functions, mappings
  const requirements = await readTable('requirements');
  await writeTable('requirements', requirements.filter((r) => r.projectId !== id));

  const functions = await readTable('functions');
  await writeTable('functions', functions.filter((f) => f.projectId !== id));

  const mappings = await readTable('mappings');
  await writeTable('mappings', mappings.filter((m) => m.projectId !== id));

  return true;
}

// === Requirement APIs ===
export async function getRequirements(projectId) {
  const list = await readTable('requirements');
  return list.filter((r) => r.projectId === projectId);
}

export async function createRequirement({ projectId, code, name, description, version = '1.0.0', status = 'unchanged' }) {
  const list = await readTable('requirements');
  const req = {
    id: uuidv4(),
    projectId,
    code,
    name,
    description,
    version,
    status,
    lastUpdated: new Date().toISOString(),
  };
  list.push(req);
  await writeTable('requirements', list);
  return req;
}

export async function updateRequirement(id, updates) {
  const list = await readTable('requirements');
  const idx = list.findIndex((r) => r.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  await writeTable('requirements', list);
  return list[idx];
}

export async function bulkCreateRequirements(projectId, reqs) {
  const list = await readTable('requirements');
  const newReqs = reqs.map((r) => ({
    id: uuidv4(),
    projectId,
    code: r.code,
    name: r.name,
    description: r.description,
    version: r.version || '1.0.0',
    status: r.status || 'unchanged',
    lastUpdated: new Date().toISOString(),
  }));
  list.push(...newReqs);
  await writeTable('requirements', list);
  return newReqs;
}

export async function deleteRequirement(id) {
  const list = await readTable('requirements');
  await writeTable('requirements', list.filter((r) => r.id !== id));

  // Clean up associated mappings
  const mappings = await readTable('mappings');
  await writeTable('mappings', mappings.filter((m) => m.requirementId !== id));
  return true;
}

export async function deleteRequirementsByProject(projectId) {
  const list = await readTable('requirements');
  await writeTable('requirements', list.filter((r) => r.projectId !== projectId));
  return true;
}

// === Function APIs ===
export async function getFunctions(projectId) {
  const list = await readTable('functions');
  return list.filter((f) => f.projectId === projectId);
}

export async function createFunction({ projectId, code, name, description, version = '1.0.0', status = 'unchanged' }) {
  const list = await readTable('functions');
  const func = {
    id: uuidv4(),
    projectId,
    code,
    name,
    description,
    version,
    status,
    lastUpdated: new Date().toISOString(),
  };
  list.push(func);
  await writeTable('functions', list);
  return func;
}

export async function updateFunction(id, updates) {
  const list = await readTable('functions');
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  await writeTable('functions', list);
  return list[idx];
}

export async function bulkCreateFunctions(projectId, funcs) {
  const list = await readTable('functions');
  const newFuncs = funcs.map((f) => ({
    id: uuidv4(),
    projectId,
    code: f.code,
    name: f.name,
    description: f.description,
    version: f.version || '1.0.0',
    status: f.status || 'unchanged',
    lastUpdated: new Date().toISOString(),
  }));
  list.push(...newFuncs);
  await writeTable('functions', list);
  return newFuncs;
}

export async function deleteFunction(id) {
  const list = await readTable('functions');
  await writeTable('functions', list.filter((f) => f.id !== id));

  // Clean up associated mappings
  const mappings = await readTable('mappings');
  await writeTable('mappings', mappings.filter((m) => m.functionId !== id));
  return true;
}

export async function deleteFunctionsByProject(projectId) {
  const list = await readTable('functions');
  await writeTable('functions', list.filter((f) => f.projectId !== projectId));
  return true;
}

// === Mapping APIs ===
export async function getMappings(projectId) {
  const list = await readTable('mappings');
  return list.filter((m) => m.projectId === projectId);
}

export async function createMapping({ projectId, requirementId, functionId, status = 'confirmed', confidence = 1, reason = '' }) {
  const list = await readTable('mappings');
  // Check if mapping already exists
  const existing = list.find((m) => m.projectId === projectId && m.requirementId === requirementId && m.functionId === functionId);
  if (existing) {
    existing.status = status;
    existing.confidence = confidence;
    existing.reason = reason;
    existing.updatedAt = new Date().toISOString();
    await writeTable('mappings', list);
    return existing;
  }
  const mapping = {
    id: uuidv4(),
    projectId,
    requirementId,
    functionId,
    status,
    confidence,
    reason,
    updatedAt: new Date().toISOString(),
  };
  list.push(mapping);
  await writeTable('mappings', list);
  return mapping;
}

export async function updateMapping(id, updates) {
  const list = await readTable('mappings');
  const idx = list.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  list[idx] = {
    ...list[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await writeTable('mappings', list);
  return list[idx];
}

export async function bulkCreateMappings(projectId, mappingsList) {
  const list = await readTable('mappings');
  
  // Filter out duplicates and append
  const added = [];
  for (const m of mappingsList) {
    const existingIdx = list.findIndex(
      (item) => item.projectId === projectId && item.requirementId === m.requirementId && item.functionId === m.functionId
    );
    const mappingObj = {
      id: existingIdx !== -1 ? list[existingIdx].id : uuidv4(),
      projectId,
      requirementId: m.requirementId,
      functionId: m.functionId,
      status: m.status || 'confirmed',
      confidence: m.confidence || 1,
      reason: m.reason || '',
      updatedAt: new Date().toISOString(),
    };
    if (existingIdx !== -1) {
      list[existingIdx] = mappingObj;
    } else {
      list.push(mappingObj);
    }
    added.push(mappingObj);
  }
  
  await writeTable('mappings', list);
  return added;
}

export async function deleteMapping(id) {
  const list = await readTable('mappings');
  await writeTable('mappings', list.filter((m) => m.id !== id));
  return true;
}

export async function deleteMappingByReqAndFun(projectId, requirementId, functionId) {
  const list = await readTable('mappings');
  await writeTable('mappings', list.filter(
    (m) => !(m.projectId === projectId && m.requirementId === requirementId && m.functionId === functionId)
  ));
  return true;
}
