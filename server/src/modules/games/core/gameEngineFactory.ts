import type { IGameEngine } from './gameEngine.types.js';
import { TruthOrDareEngine } from '../engines/truth-or-dare/truthOrDare.engine.js';
import { WouldYouRatherEngine } from '../engines/would-you-rather/wouldYouRather.engine.js';
import { BlindRankingEngine } from '../engines/blind-ranking/blindRanking.engine.js';
import { OriginalCardGameEngine } from '../engines/original-card-game/originalCardGame.engine.js';
import { TicTacToeEngine } from '../engines/tic-tac-toe/ticTacToe.engine.js';
import { PenFightEngine } from '../engines/pen-fight/penFight.engine.js';
import { KabzaEngine } from '../engines/kabza/kabza.engine.js';
import { BasketballRivalryEngine } from '../engines/basketball-rivalry/basketballRivalry.engine.js';
import { SnatchTheFriesEngine } from '../engines/snatch-the-fries/snatchTheFries.engine.js';
import { AlooGolfEngine } from '../engines/aloo-golf/alooGolf.engine.js';
import { BetweenUsEngine } from '../engines/between-us/betweenUs.engine.js';

export class GameEngineFactory {
  private engines: Map<string, IGameEngine> = new Map();

  constructor() {
    this.registerEngine(new TruthOrDareEngine());
    this.registerEngine(new WouldYouRatherEngine());
    this.registerEngine(new BlindRankingEngine());
    this.registerEngine(new OriginalCardGameEngine());
    this.registerEngine(new TicTacToeEngine());
    this.registerEngine(new PenFightEngine());
    this.registerEngine(new KabzaEngine());
    this.registerEngine(new BasketballRivalryEngine());
    this.registerEngine(new SnatchTheFriesEngine());
    this.registerEngine(new AlooGolfEngine());
    this.registerEngine(new BetweenUsEngine());
  }

  registerEngine(engine: IGameEngine): void {
    this.engines.set(engine.gameId, engine);
  }

  getEngine(gameId: string): IGameEngine {
    const engine = this.engines.get(gameId);
    if (!engine) {
      throw new Error(`Unsupported game engine: ${gameId}`);
    }
    return engine;
  }

  hasEngine(gameId: string): boolean {
    return this.engines.has(gameId);
  }
}

export const gameEngineFactory = new GameEngineFactory();

