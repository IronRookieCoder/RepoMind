/**
 * Agent调度器
 * 负责管理所有分析Agent的生命周期、任务分发和结果聚合
 */

import { 
  AnalysisConfig, 
  KnowledgeGenerationResult
} from '../../types';
import { TaskListManager } from '../TaskListManager';

export class AgentScheduler {
  private taskListManager: TaskListManager;

  constructor() {
    this.taskListManager = new TaskListManager();
  }

  /**
   * 执行知识库生成的主入口
   * 使用TaskListManager进行单次SDK调用
   */
  async executeKnowledgeGeneration(config: AnalysisConfig): Promise<KnowledgeGenerationResult> {
    return this.taskListManager.executeKnowledgeGeneration(config);
  }

}