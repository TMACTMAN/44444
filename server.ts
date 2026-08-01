import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { globalWorld } from './src/engine/worldState';
import { SchedulerEngine, WAKE_WEIGHTS } from './src/engine/scheduler';
import { NPCCognitionEngine } from './src/engine/npcCognition';
import { CausalityEngine } from './src/engine/causality';
import { TruthsEngine } from './src/engine/truthsEngine';
import { DMEngine } from './src/engine/dmEngine';
import { check7Invariants } from './src/engine/invariants';
import { WorldBootstrap } from './src/engine/world/worldBootstrap';
import { WorldRepository } from './src/engine/world/worldRepository';
import { recorder } from './src/engine/recorder/recorder';
import { StateChangeProposal } from './src/engine/recorder/changeSchemas';

import { TransactionService } from './src/engine/timeline/transactionService';
import { CheckpointProcessor } from './src/engine/timeline/checkpointProcessor';
import { TimelineError } from './src/engine/timeline/timelineErrors';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // === INITIALIZE PERSISTENCE LAYER ===
  try {
    await WorldBootstrap.bootstrap('world-snapshot-001');
  } catch (dbErr) {
    console.error('Failed to initialize SQLite persistent world engine:', dbErr);
  }

  // === REST API ENDPOINTS ===

  // 0. API & LLM Provider Configuration
  let apiConfig = {
    provider: process.env.LLM_PROVIDER || 'gemini',
    model: process.env.LLM_MODEL || 'gemini-2.5-flash',
    baseUrl: process.env.LLM_BASE_URL || 'https://generativelanguage.googleapis.com',
    hasApiKey: !!process.env.GEMINI_API_KEY,
  };

  app.get('/api/v1/config', (req, res) => {
    res.json({
      ...apiConfig,
      hasApiKey: !!process.env.GEMINI_API_KEY,
    });
  });

  app.post('/api/v1/config', (req, res) => {
    const { provider, model, baseUrl, apiKey } = req.body;
    if (provider) apiConfig.provider = provider;
    if (model) apiConfig.model = model;
    if (baseUrl) apiConfig.baseUrl = baseUrl;
    if (apiKey) {
      process.env.GEMINI_API_KEY = apiKey;
    }
    res.json({ status: 'ok', config: { ...apiConfig, hasApiKey: !!process.env.GEMINI_API_KEY } });
  });

  // 1. Get World Snapshot & Overview
  app.get('/api/v1/world/snapshot', (req, res) => {
    globalWorld.updateStats();
    res.json({
      snapshot: globalWorld.snapshot,
      stats: globalWorld.getStats(),
    });
  });

  // 2. Get Characters
  app.get('/api/v1/characters', (req, res) => {
    res.json(Array.from(globalWorld.characters.values()));
  });

  app.get('/api/v1/characters/:id', (req, res) => {
    const char = globalWorld.characters.get(req.params.id);
    if (!char) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }
    res.json(char);
  });

  // 3. Get Locations
  app.get('/api/v1/locations', (req, res) => {
    res.json(Array.from(globalWorld.locations.values()));
  });

  app.get('/api/v1/locations/:id', (req, res) => {
    const loc = globalWorld.locations.get(req.params.id);
    if (!loc) {
      res.status(404).json({ error: 'Location not found' });
      return;
    }
    res.json(loc);
  });

  // 4. Get Organizations
  app.get('/api/v1/organizations', (req, res) => {
    res.json(Array.from(globalWorld.organizations.values()));
  });

  // 5. Get Active Seeds & Causality Pressures
  app.get('/api/v1/seeds/active', (req, res) => {
    const active = Array.from(globalWorld.seeds.values()).filter((s) => s.status === 'IN_PROGRESS');
    const pressures = CausalityEngine.evaluatePressures();
    res.json({ seeds: active, pressures });
  });

  // 6. Get Recent Events
  app.get('/api/v1/events/recent', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    res.json(globalWorld.events.slice(0, limit));
  });

  // 7. Get Hidden Truths
  app.get('/api/v1/truths', (req, res) => {
    res.json(Array.from(globalWorld.hiddenTruths.values()));
  });

  // 8. Character Action (Travel, Investigate, Rest, etc.)
  app.post('/api/v1/dm/action', async (req, res) => {
    const { action_text } = req.body;
    if (!action_text || typeof action_text !== 'string') {
      res.status(400).json({ error: 'action_text is required' });
      return;
    }
    const dmResult = await DMEngine.processPlayerAction(action_text);
    res.json(dmResult);
  });

  app.post('/api/v1/characters/:id/action', async (req, res) => {
    const { action_type, target_location_id, details } = req.body;
    const char = globalWorld.characters.get(req.params.id);
    if (!char) {
      res.status(404).json({ error: 'Character not found' });
      return;
    }

    const proposals: StateChangeProposal[] = [];
    const currentEpoch = globalWorld.snapshot.epoch;

    if (action_type === 'TRAVEL' && target_location_id) {
      const targetLoc = globalWorld.locations.get(target_location_id);
      if (targetLoc) {
        proposals.push({
          id: `prop-route-move-${Date.now()}`,
          operation: 'MOVE_CHARACTER',
          entityType: 'CHARACTER',
          entityId: char.id,
          payload: { characterId: char.id, targetLocationId: target_location_id, bypassConnectivity: true },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'PLAYER_ACTION' },
        });

        proposals.push({
          id: `prop-route-act-${Date.now()}`,
          operation: 'SET_CHARACTER_ACTION',
          entityType: 'CHARACTER',
          entityId: char.id,
          payload: {
            characterId: char.id,
            action: {
              type: 'TRAVEL',
              description: `前往 ${targetLoc.name}`,
              started_at_epoch: currentEpoch,
              estimated_end_epoch: currentEpoch + 1,
            },
          },
          effectiveEpoch: currentEpoch,
          preconditions: [],
          source: { type: 'PLAYER_ACTION' },
        });

        SchedulerEngine.pushWakeSignal({
          entity_id: char.id,
          entity_type: 'CHARACTER',
          reason: 'PLAYER_APPROACH',
          epoch: currentEpoch,
          weight: 0,
        });
      }
    } else if (action_type === 'REST') {
      proposals.push({
        id: `prop-route-rest-${Date.now()}`,
        operation: 'UPDATE_CHARACTER_ATTRIBUTES',
        entityType: 'CHARACTER',
        entityId: char.id,
        payload: {
          characterId: char.id,
          hpDelta: 20,
          mpDelta: 15,
        },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'PLAYER_ACTION' },
      });

      proposals.push({
        id: `prop-route-restact-${Date.now()}`,
        operation: 'SET_CHARACTER_ACTION',
        entityType: 'CHARACTER',
        entityId: char.id,
        payload: {
          characterId: char.id,
          action: {
            type: 'REST',
            description: '在旅店静养恢复生命与精力',
            started_at_epoch: currentEpoch,
            estimated_end_epoch: currentEpoch + 1,
          },
        },
        effectiveEpoch: currentEpoch,
        preconditions: [],
        source: { type: 'PLAYER_ACTION' },
      });
    }

    if (proposals.length > 0) {
      await recorder.commit('world-snapshot-001', proposals);
    }

    const updatedChar = globalWorld.characters.get(req.params.id);
    res.json({ status: 'ok', character: updatedChar });
  });

  // 9. NPC Dialogue (Gemini AI Powered)
  app.post('/api/v1/characters/:id/dialogue', async (req, res) => {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message required' });
      return;
    }

    const pc = globalWorld.characters.get('pc-player');
    const result = await NPCCognitionEngine.generateNPCDialogue(
      req.params.id,
      message,
      pc ? pc.name : '卡尔'
    );

    res.json(result);
  });

  // 10. Advance Epoch Tick
  app.post('/api/v1/admin/epoch/tick', async (req, res) => {
    const tickResult = await SchedulerEngine.processEpochTick();
    const seedEvents = await CausalityEngine.tickSeeds();

    res.json({
      ...tickResult,
      events_generated: seedEvents.length,
      snapshot: globalWorld.snapshot,
    });
  });

  // 11. Deep AI Causality Evaluation
  app.post('/api/v1/causality/evaluate', async (req, res) => {
    const result = await CausalityEngine.generateDeepCausalityEvaluation();
    res.json({ evaluation: result });
  });

  // 12. Collect Evidence for Truth
  app.post('/api/v1/truths/collect-evidence', async (req, res) => {
    const { truth_id, evidence_name } = req.body;
    if (!truth_id || !evidence_name) {
      res.status(400).json({ error: 'truth_id and evidence_name required' });
      return;
    }
    const result = await TruthsEngine.addEvidenceToTruth(truth_id, evidence_name);
    res.json(result);
  });

  // 13. Reveal Truth
  app.post('/api/v1/truths/reveal', async (req, res) => {
    const { truth_id, revealer_id } = req.body;
    if (!truth_id) {
      res.status(400).json({ error: 'truth_id required' });
      return;
    }
    const result = await TruthsEngine.revealTruth(truth_id, revealer_id || 'pc-player');
    res.json(result);
  });

  // 13.5. AI Adventure Illustration Generation
  app.post('/api/v1/art/generate', (req, res) => {
    const { locationName, narrationSummary } = req.body;
    const loc = locationName || '艾尔德兰荒野';
    const summary = narrationSummary || '黑夜中的冒险故事在流转';

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const seed = encodeURIComponent(`${loc}-${Date.now()}`);
    const prompt = `Dark fantasy RPG epic digital painting, ${loc}, ${summary.slice(0, 40)}, intricate detail, cinematic lighting, masterpiece`;

    const artCard = {
      id: `art-${Date.now()}`,
      title: `${loc} • 冒险现场画卷`,
      locationName: loc,
      narrationSummary: summary,
      imageUrl: `https://picsum.photos/seed/${seed}/800/600`,
      prompt,
      epoch: globalWorld.snapshot.epoch,
      timestamp,
    };

    res.json({ status: 'ok', artCard });
  });

  // === PHASE 3 TIMELINE API ENDPOINTS ===

  // Plan travel transaction
  app.post('/api/v1/timeline/plan-travel', async (req, res) => {
    try {
      const { worldId = 'world-snapshot-001', actorId, destinationLocationId, startEpoch, speedMultiplier } = req.body;
      if (!actorId || !destinationLocationId) {
        res.status(400).json({ error: 'actorId and destinationLocationId are required' });
        return;
      }
      const effectiveStartEpoch = typeof startEpoch === 'number' ? startEpoch : globalWorld.snapshot.epoch;
      const result = await TransactionService.planTravel({
        worldId,
        actorId,
        destinationLocationId,
        startEpoch: effectiveStartEpoch,
        speedMultiplier,
      });
      res.json({ status: 'ok', ...result });
    } catch (err: any) {
      if (err instanceof TimelineError) {
        res.status(400).json({ error: err.message, code: err.code });
      } else {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  });

  // Cancel transaction
  app.post('/api/v1/timeline/cancel-transaction', async (req, res) => {
    try {
      const { worldId = 'world-snapshot-001', transactionId, reason = 'User cancelled', epoch } = req.body;
      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
        return;
      }
      const effectiveEpoch = typeof epoch === 'number' ? epoch : globalWorld.snapshot.epoch;
      await TransactionService.cancelTransaction(worldId, transactionId, reason, effectiveEpoch);
      res.json({ status: 'ok', transactionId });
    } catch (err: any) {
      if (err instanceof TimelineError) {
        res.status(400).json({ error: err.message, code: err.code });
      } else {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  });

  // Fail transaction
  app.post('/api/v1/timeline/fail-transaction', async (req, res) => {
    try {
      const { worldId = 'world-snapshot-001', transactionId, reason = 'Travel interrupted', epoch } = req.body;
      if (!transactionId) {
        res.status(400).json({ error: 'transactionId is required' });
        return;
      }
      const effectiveEpoch = typeof epoch === 'number' ? epoch : globalWorld.snapshot.epoch;
      await TransactionService.failTransaction(worldId, transactionId, reason, effectiveEpoch);
      res.json({ status: 'ok', transactionId });
    } catch (err: any) {
      if (err instanceof TimelineError) {
        res.status(400).json({ error: err.message, code: err.code });
      } else {
        res.status(500).json({ error: err.message || 'Internal server error' });
      }
    }
  });

  // Get active transactions for actor
  app.get('/api/v1/timeline/transactions/:actorId', async (req, res) => {
    try {
      const worldId = (req.query.worldId as string) || 'world-snapshot-001';
      const transactions = await WorldRepository.getTransactionsForActor(worldId, req.params.actorId);
      res.json({ status: 'ok', transactions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get due checkpoints
  app.get('/api/v1/timeline/checkpoints/due', async (req, res) => {
    try {
      const worldId = (req.query.worldId as string) || 'world-snapshot-001';
      const epoch = parseInt(req.query.epoch as string) || globalWorld.snapshot.epoch;
      const checkpoints = await WorldRepository.getDueCheckpoints(worldId, epoch);
      res.json({ status: 'ok', checkpoints });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Process due checkpoints manually
  app.post('/api/v1/timeline/checkpoints/process', async (req, res) => {
    try {
      const { worldId = 'world-snapshot-001', epoch } = req.body;
      const effectiveEpoch = typeof epoch === 'number' ? epoch : globalWorld.snapshot.epoch;
      const result = await CheckpointProcessor.processDueCheckpoints(worldId, effectiveEpoch);
      res.json({ status: 'ok', ...result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 14. Admin Stats & Invariant Checks
  app.get('/api/v1/admin/stats', (req, res) => {
    const invCheck = check7Invariants(
      globalWorld.snapshot,
      Array.from(globalWorld.characters.values()),
      Array.from(globalWorld.seeds.values()),
      globalWorld.events
    );

    res.json({
      stats: globalWorld.getStats(),
      invariants: invCheck,
    });
  });

  // 14.5. Get Persistence Atomic State Change Log
  app.get('/api/v1/persistence/changelog', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await WorldRepository.getChangeLogs('world-snapshot-001', limit);
      res.json({ status: 'ok', logs });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 15. Reset World to Initial Baseline
  app.post('/api/v1/world/reset', async (req, res) => {
    globalWorld.initDefaultWorld();
    await WorldRepository.saveWorldSnapshot(globalWorld.snapshot); // audit-direct-write: allow reset endpoint
    res.json({ status: 'reset_completed', snapshot: globalWorld.snapshot });
  });

  // === VITE MIDDLEWARE SETUP ===
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: express.Request, res: express.Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
