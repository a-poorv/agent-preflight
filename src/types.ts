export interface Skill {
  name: string;
  pattern: string;
  ref: string;
  efficiency: number;
}

export interface Constraint {
  type: 'explicit' | 'boundary' | 'system';
  rule: string;
}

export interface ExecutionStep {
  id: number;
  action: string;
  desc: string;
  checkpoint: boolean;
  risk: 'low' | 'medium' | 'high';
  skillRef?: string;
  reasoning?: string;
  pauseReason?: string;
}

export interface ExecutionPlan {
  steps: ExecutionStep[];
  totalSteps: number;
}

export interface OptimizationProfile {
  description: string;
  tokens: number;
  quality: number;
  latency: number;
  bullets: string[];
  mode: 'agent' | 'manual';
  profileType: 'balanced' | 'speed';
}

export interface AgentSetupQuestion {
  question: string;
  answer: string;
}

export interface LearningProfile {
  successRate: number;
  checkpointPreference: 'strict' | 'balanced' | 'light';
  taskStats: { total: number; success: number };
}

export interface LeadAgent {
  id: string;
  icon: string;
  directive: string;
}

export interface Recommendation {
  mode: 'agent' | 'manual';
  confidence: number;
  reasoning: string;
}

export interface Complexity {
  riskLevel: 'low' | 'medium' | 'high';
  wordCount: number;
  stepCount: number;
}

export interface SuggestedSkill {
  name: string;
  ref: string;
  pattern: string;
  rationale: string;
  score?: number;
}

export interface PreFlightAnalysis {
  id: string;
  platform: string;
  prompt: string;
  mission: string;
  leadAgent: LeadAgent;
  systemLimits: string[];
  taskType: string;
  taskLabel: string;
  taskIcon: string;
  complexity: Complexity;
  constraints: Constraint[];
  skillMatches: Skill[];
  suggestedSkills: SuggestedSkill[];
  agentSetupQuestions: AgentSetupQuestion[];
  learningProfile: LearningProfile;
  executionPlan: ExecutionPlan;
  optimizationProfile: OptimizationProfile;
  recommendation: Recommendation;
}

export interface RuntimeIntervention {
  level: 'high' | 'medium';
  driftScore: number;
  message: string;
  recommendation: string;
  escalateCheckpoint: boolean;
  pauseReason: string | null;
}

export interface ApiSkillResponse {
  skills: Skill[];
}
