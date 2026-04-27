import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_FILE = join(__dirname, 'data', 'skills.json');

interface Skill {
  name: string;
  pattern: string;
  ref: string;
  efficiency: number;
}

const DEFAULT_SKILLS: Skill[] = [
  { name: 'Home Page Patterns', pattern: 'home page', ref: '/home-skill.md', efficiency: 15 },
  { name: 'Auth Protocol', pattern: 'login|auth|sign up', ref: '/auth-skill.md', efficiency: 20 },
  { name: 'UI Standards', pattern: 'design|layout|css|style', ref: '/ui-skill.md', efficiency: 10 },
];

// Ensure data directory and skills file exist
import { mkdirSync } from 'fs';
try { mkdirSync(join(__dirname, 'data'), { recursive: true }); } catch { /* exists */ }
if (!existsSync(SKILLS_FILE)) {
  writeFileSync(SKILLS_FILE, JSON.stringify(DEFAULT_SKILLS, null, 2));
}

function readSkills(): Skill[] {
  try {
    return JSON.parse(readFileSync(SKILLS_FILE, 'utf-8')) as Skill[];
  } catch {
    return [...DEFAULT_SKILLS];
  }
}

function writeSkills(skills: Skill[]): void {
  writeFileSync(SKILLS_FILE, JSON.stringify(skills, null, 2));
}

const app = express();
app.use(cors());
app.use(express.json());

// GET all skills
app.get('/api/skills', (_req, res) => {
  res.json({ skills: readSkills() });
});

// POST — add a new skill
app.post('/api/skills', (req, res) => {
  const skill = req.body as Skill;
  if (!skill.name || !skill.pattern || !skill.ref) {
    res.status(400).json({ error: 'name, pattern, and ref are required' });
    return;
  }
  const skills = readSkills();
  const existing = skills.findIndex(s => s.ref === skill.ref);
  if (existing >= 0) {
    skills[existing] = { ...skills[existing], ...skill };
  } else {
    skills.push({ efficiency: 10, ...skill });
  }
  writeSkills(skills);
  res.status(201).json({ skill: skills.find(s => s.ref === skill.ref) });
});

// PATCH — update skill fields by ref
app.patch('/api/skills/:ref', (req, res) => {
  const ref = decodeURIComponent(req.params['ref'] ?? '');
  const updates = req.body as Partial<Skill>;
  const skills = readSkills();
  const idx = skills.findIndex(s => s.ref === ref);
  if (idx < 0) {
    res.status(404).json({ error: 'skill not found' });
    return;
  }
  skills[idx] = { ...skills[idx], ...updates };
  writeSkills(skills);
  res.json({ skill: skills[idx] });
});

// DELETE — remove a skill by ref
app.delete('/api/skills/:ref', (req, res) => {
  const ref = decodeURIComponent(req.params['ref'] ?? '');
  const skills = readSkills();
  const filtered = skills.filter(s => s.ref !== ref);
  if (filtered.length === skills.length) {
    res.status(404).json({ error: 'skill not found' });
    return;
  }
  writeSkills(filtered);
  res.json({ deleted: ref });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Skill API running at http://localhost:${PORT}`);
});
