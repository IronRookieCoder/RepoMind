/**
 * Agent调度器
 * 负责管理所有分析Agent的生命周期、任务分发和结果聚合
 */

import { promises as fs } from 'fs';
import path from 'path';
import { 
  BaseAnalysisAgent, 
  AnalysisConfig, 
  AnalysisResult, 
  AnalysisTask,
  KnowledgeGenerationResult,
  KnowledgeIndex,
  ValidationReport
} from '../../types';
import { writeYamlFile } from '../../utils';

// 导入所有Agent
import { OverviewAnalysisAgent } from '../OverviewAnalysisAgent';
import { ArchitectureAnalysisAgent } from '../ArchitectureAnalysisAgent';
import { ComponentAnalysisAgent } from '../ComponentAnalysisAgent';
import { ApiAnalysisAgent } from '../ApiAnalysisAgent';
import { DataModelAnalysisAgent } from '../DataModelAnalysisAgent';
import { WorkflowAnalysisAgent } from '../WorkflowAnalysisAgent';

export class AgentScheduler {
  private agents: Map<string, BaseAnalysisAgent>;

  constructor(_maxConcurrent: number = 3) {
    this.agents = new Map();
    // 未来的扩展功能预留参数
    // this._taskQueue = [];
    // this._maxConcurrentTasks = _maxConcurrent;  
    // this._runningTasks = new Set();
    this.initializeAgents();
  }

  /**
   * 初始化所有分析Agent
   */
  private initializeAgents(): void {
    console.log('正在初始化分析Agent...');
    
    this.registerAgent(new OverviewAnalysisAgent());
    this.registerAgent(new ArchitectureAnalysisAgent());
    this.registerAgent(new ComponentAnalysisAgent());
    this.registerAgent(new ApiAnalysisAgent());
    this.registerAgent(new DataModelAnalysisAgent());
    this.registerAgent(new WorkflowAnalysisAgent());
    
    console.log(`已注册 ${this.agents.size} 个分析Agent`);
  }

  /**
   * 注册Agent
   */
  private registerAgent(agent: BaseAnalysisAgent): void {
    this.agents.set(agent.name, agent);
    console.log(`已注册Agent: ${agent.name} v${agent.version}`);
  }

  /**
   * 执行知识库生成的主入口
   */
  async executeKnowledgeGeneration(config: AnalysisConfig): Promise<KnowledgeGenerationResult> {
    console.log('🚀 开始执行知识库生成...');
    console.log(`项目路径: ${config.repoPath}`);
    console.log(`输出路径: ${config.outputPath}`);
    console.log(`分析深度: ${config.depth}`);
    
    try {
      // 1. 任务分解
      console.log('📋 分解分析任务...');
      const tasks = this.decomposeTasks(config);
      console.log(`生成了 ${tasks.length} 个分析任务`);
      
      // 2. 并行执行所有任务（无需预构建上下文）
      console.log('⚙️ 开始并行执行分析任务...');
      const results = await this.executeTasksInParallel(tasks, config);
      
      // 4. 结果聚合
      console.log('📊 聚合分析结果...');
      const aggregatedResult = this.aggregateResults(results);
      
      // 5. 质量检查
      console.log('🔍 执行质量检查...');
      const validationResult = await this.validateResults(aggregatedResult);
      
      // 6. 知识库更新
      console.log('💾 更新知识库文件...');
      await this.updateKnowledgeBase(validationResult, config);
      
      console.log('✅ 知识库生成完成!');
      console.log(`整体置信度: ${(validationResult.overallConfidence * 100).toFixed(1)}%`);
      console.log(`生成文件数: ${validationResult.generatedFiles.length}`);
      
      return validationResult;
    } catch (error) {
      console.error('❌ 知识库生成失败:', error);
      throw error;
    }
  }

  /**
   * 分解分析任务（移除依赖关系，支持并行执行）
   */
  private decomposeTasks(config: AnalysisConfig): AnalysisTask[] {
    const baseTasks: AnalysisTask[] = [
      { id: 'overview', agentName: 'overview-analysis', priority: 1 },
      { id: 'architecture', agentName: 'architecture-analysis', priority: 2 },
      { id: 'components', agentName: 'component-analysis', priority: 3 },
      { id: 'apis', agentName: 'api-analysis', priority: 4 },
      { id: 'data-models', agentName: 'data-model-analysis', priority: 4 },
      { id: 'workflows', agentName: 'workflow-analysis', priority: 5 },
    ];

    // 根据配置调整任务
    if (!config.includeTests) {
      // 如果不包含测试，可以调整某些任务的优先级
    }
    
    if (!config.includeDocs) {
      // 如果不包含文档，可能需要更深入的代码分析
    }

    return baseTasks;
  }


  /**
   * 并行执行分析任务
   */
  private async executeTasksInParallel(tasks: AnalysisTask[], config: AnalysisConfig): Promise<AnalysisResult[]> {
    const startTime = Date.now();
    console.log(`🚀 启动 ${tasks.length} 个并行分析任务...`);

    // 创建所有任务的Promise
    const taskPromises = tasks.map(async (task, index) => {
      const agent = this.agents.get(task.agentName);
      if (!agent) {
        throw new Error(`未找到Agent: ${task.agentName}`);
      }

      console.log(`[${index + 1}/${tasks.length}] 🔄 启动任务: ${task.id} (${agent.name})`);
      const taskStartTime = Date.now();
      
      try {
        const result = await agent.execute(config);
        const taskDuration = Date.now() - taskStartTime;
        
        const statusIcon = result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';
        console.log(`${statusIcon} 任务完成: ${task.id}`);
        console.log(`   状态: ${result.status}`);
        console.log(`   置信度: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   耗时: ${taskDuration}ms`);
        
        if (result.status === 'error') {
          console.error(`   错误: ${result.output.metadata.error}`);
        }
        
        return result;
        
      } catch (error) {
        console.error(`❌ 任务执行失败: ${task.id}`, error);
        
        // 创建错误结果
        const errorResult: AnalysisResult = {
          agentName: agent.name,
          status: 'error',
          output: {
            document: '',
            metadata: { error: (error as Error).message },
            references: []
          },
          executionTime: Date.now() - taskStartTime,
          confidence: 0
        };
        
        return errorResult;
      }
    });

    // 等待所有任务完成
    const results = await Promise.all(taskPromises);
    
    const totalDuration = Date.now() - startTime;
    console.log(`🎯 所有并行任务执行完成，总耗时: ${totalDuration}ms`);
    
    // 按优先级排序结果（保持输出的一致性）
    const sortedResults = results.sort((a, b) => {
      const taskA = tasks.find(t => t.agentName === a.agentName);
      const taskB = tasks.find(t => t.agentName === b.agentName);
      return (taskA?.priority || 0) - (taskB?.priority || 0);
    });

    return sortedResults;
  }


  /**
   * 聚合分析结果
   */
  private aggregateResults(results: AnalysisResult[]): KnowledgeGenerationResult {
    const successResults = results.filter(r => r.status === 'success');
    const partialResults = results.filter(r => r.status === 'partial');
    const errorResults = results.filter(r => r.status === 'error');
    
    // 计算整体置信度
    const totalConfidence = successResults.length > 0 
      ? successResults.reduce((sum, r) => sum + r.confidence, 0) / successResults.length 
      : 0;

    // 确定整体状态
    let overallStatus: 'success' | 'partial' | 'error' = 'success';
    if (errorResults.length > 0) {
      overallStatus = successResults.length > 0 ? 'partial' : 'error';
    } else if (partialResults.length > 0) {
      overallStatus = 'partial';
    }

    const generatedFiles = this.extractGeneratedFiles(results);
    
    // 收集警告信息
    const warnings: string[] = [];
    if (errorResults.length > 0) {
      warnings.push(`${errorResults.length} 个任务执行失败`);
    }
    if (partialResults.length > 0) {
      warnings.push(`${partialResults.length} 个任务部分成功`);
    }
    if (totalConfidence < 0.6) {
      warnings.push('整体置信度较低，建议检查分析结果');
    }

    return {
      status: overallStatus,
      results: results,
      overallConfidence: totalConfidence,
      generatedFiles: generatedFiles,
      metadata: {
        totalTasks: results.length,
        successfulTasks: successResults.length,
        averageExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0) / results.length,
        timestamp: new Date().toISOString(),
        ...(warnings.length > 0 && { warnings })
      }
    };
  }

  /**
   * 提取生成的文件列表
   */
  private extractGeneratedFiles(results: AnalysisResult[]): string[] {
    const files: string[] = [];
    
    results.forEach(result => {
      if (result.status === 'success' || result.status === 'partial') {
        const agentFiles = this.getOutputPaths(result.agentName);
        files.push(...agentFiles);
      }
    });
    
    return files;
  }

  /**
   * 获取Agent对应的输出文件路径
   */
  private getOutputPaths(agentName: string): string[] {
    const pathMap: Record<string, string[]> = {
      'overview-analysis': ['docs/overview.md'],
      'architecture-analysis': ['docs/architecture.md'],
      'component-analysis': ['docs/components.md'],
      'api-analysis': ['docs/apis.md'],
      'data-model-analysis': ['docs/data-models.md'],
      'workflow-analysis': ['docs/workflows.md']
    };
    
    return pathMap[agentName] || [];
  }

  /**
   * 验证分析结果
   */
  private async validateResults(result: KnowledgeGenerationResult): Promise<KnowledgeGenerationResult> {
    console.log('🔍 执行质量验证...');
    
    const validationReport: ValidationReport = {
      overallScore: result.overallConfidence,
      dimensions: {},
      issues: [],
      suggestions: []
    };

    // 检查必要文件是否生成
    const requiredFiles = ['docs/overview.md', 'docs/architecture.md', 'docs/components.md'];
    const missingFiles = requiredFiles.filter(file => !result.generatedFiles.includes(file));
    
    if (missingFiles.length > 0) {
      validationReport.issues.push(`缺少必要文件: ${missingFiles.join(', ')}`);
      if (!result.metadata.warnings) result.metadata.warnings = [];
      result.metadata.warnings.push(`缺少必要文件: ${missingFiles.join(', ')}`);
    }

    // 检查置信度
    if (result.overallConfidence < 0.5) {
      validationReport.issues.push('整体置信度过低，建议重新分析');
      validationReport.suggestions.push('考虑增加分析深度或检查项目结构');
    } else if (result.overallConfidence < 0.7) {
      validationReport.suggestions.push('整体置信度偏低，建议检查关键组件的分析质量');
    }

    // 检查成功率
    const successRate = result.metadata.successfulTasks / result.metadata.totalTasks;
    if (successRate < 0.7) {
      validationReport.issues.push('任务成功率过低');
      validationReport.suggestions.push('检查项目结构和依赖配置是否正确');
    }

    console.log(`验证完成 - 发现 ${validationReport.issues.length} 个问题，${validationReport.suggestions.length} 个建议`);
    
    return result;
  }

  /**
   * 更新知识库文件
   */
  private async updateKnowledgeBase(result: KnowledgeGenerationResult, config: AnalysisConfig): Promise<void> {
    console.log('💾 开始更新知识库...');
    
    // 创建.repomind目录结构
    await this.ensureDirectoryStructure(config.outputPath);
    
    // 生成knowledge.yaml主索引文件
    const knowledgeIndex = this.generateKnowledgeIndex(result, config);
    const indexPath = path.join(config.outputPath, '.repomind', 'knowledge.yaml');
    await writeYamlFile(indexPath, knowledgeIndex);
    console.log('✅ 生成主索引文件: knowledge.yaml');
    
    // 写入各个分析结果文档
    let writtenCount = 0;
    for (const analysisResult of result.results) {
      if (analysisResult.status === 'success' || analysisResult.status === 'partial') {
        await this.writeAgentOutput(analysisResult, config.outputPath);
        writtenCount++;
      }
    }
    console.log(`✅ 写入 ${writtenCount} 个分析文档`);
    
    // 生成元数据文件
    await this.generateMetadata(result, config);
    console.log('✅ 生成元数据文件');
    
    console.log('🎉 知识库更新完成!');
  }

  /**
   * 确保目录结构存在
   */
  private async ensureDirectoryStructure(outputPath: string): Promise<void> {
    const directories = [
      '.repomind',
      '.repomind/meta',
      '.repomind/docs',
      '.repomind/knowledge-base',
      '.repomind/knowledge-base/core',
      '.repomind/knowledge-base/patterns',
      '.repomind/knowledge-base/best-practices',
      '.repomind/knowledge-base/troubleshooting'
    ];

    for (const dir of directories) {
      const fullPath = path.join(outputPath, dir);
      try {
        await fs.mkdir(fullPath, { recursive: true });
      } catch (error) {
        // 目录可能已存在，忽略错误
      }
    }
  }

  /**
   * 生成知识库索引
   */
  private generateKnowledgeIndex(result: KnowledgeGenerationResult, config: AnalysisConfig): KnowledgeIndex {
    return {
      version: '1.0.0',
      repository: {
        name: this.extractProjectName(config.repoPath),
        path: config.repoPath,
        language: 'unknown', // 这里可以从分析结果中提取
        analysisDepth: config.depth,
        includeTests: config.includeTests
      },
      generatedAt: new Date().toISOString(),
      analysisConfig: config,
      contentIndex: {
        overview: './docs/overview.md',
        architecture: './docs/architecture.md',
        components: './docs/components.md',
        apis: './docs/apis.md',
        dataModels: './docs/data-models.md',
        workflows: './docs/workflows.md'
      },
      metadata: result.metadata,
      qualityMetrics: {
        overallConfidence: result.overallConfidence,
        successfulTasks: result.results.filter(r => r.status === 'success').length,
        totalTasks: result.results.length
      }
    };
  }

  /**
   * 写入Agent输出
   */
  private async writeAgentOutput(result: AnalysisResult, outputPath: string): Promise<void> {
    const filePaths = this.getOutputPaths(result.agentName);
    
    for (const filePath of filePaths) {
      const fullPath = path.join(outputPath, '.repomind', filePath);
      
      // 确保父目录存在
      const dir = path.dirname(fullPath);
      await fs.mkdir(dir, { recursive: true });
      
      // 写入文档内容
      await fs.writeFile(fullPath, result.output.document, 'utf-8');
      console.log(`  ✍️ ${filePath}`);
    }
  }


  /**
   * 生成元数据文件
   */
  private async generateMetadata(result: KnowledgeGenerationResult, config: AnalysisConfig): Promise<void> {
    const metaDir = path.join(config.outputPath, '.repomind', 'meta');
    
    // 生成repo-info.yaml
    const repoInfo = {
      name: this.extractProjectName(config.repoPath),
      path: config.repoPath,
      analysisDate: new Date().toISOString(),
      version: '1.0.0'
    };
    await writeYamlFile(path.join(metaDir, 'repo-info.yaml'), repoInfo);
    
    // 生成analysis-config.yaml
    await writeYamlFile(path.join(metaDir, 'analysis-config.yaml'), config);
    
    // 生成generation-log.yaml
    const log = {
      executionId: this.generateExecutionId(),
      startTime: result.metadata.timestamp,
      endTime: new Date().toISOString(),
      tasks: result.results.map(r => ({
        agent: r.agentName,
        status: r.status,
        executionTime: r.executionTime,
        confidence: r.confidence
      })),
      overallStatus: result.status,
      overallConfidence: result.overallConfidence,
      warnings: result.metadata.warnings || []
    };
    await writeYamlFile(path.join(metaDir, 'generation-log.yaml'), log);
  }

  /**
   * 提取项目名称
   */
  private extractProjectName(repoPath: string): string {
    return path.basename(repoPath) || '未知项目';
  }

  /**
   * 生成执行ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}