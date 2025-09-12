/**
 * 任务清单管理器
 * 负责管理所有分析任务，使用单次SDK调用完成知识库构建
 */

import { promises as fs } from 'fs';
import path from 'path';
import { 
  AnalysisConfig, 
  KnowledgeGenerationResult,
  KnowledgeIndex,
  AnalysisResult
} from '../types';
import { SDKHelper } from '../utils/sdk-helper';
import { writeYamlFile } from '../utils';

interface AnalysisTask {
  id: string;
  name: string;
  promptFile: string;
  outputFile: string;
  priority: number;
  description: string;
}

interface TaskOutput {
  taskId: string;
  document: string;
  metadata: Record<string, any>;
  references: string[];
}

export class TaskListManager {
  private promptCache = new Map<string, string>();
  private realtimeWrittenTasks = new Set<string>(); // 跟踪实时写入的任务

  /**
   * 格式化时间戳为可读格式
   */
  private static formatTimestamp(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `[${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${milliseconds}Z]`;
  }

  private static readonly ANALYSIS_TASKS: AnalysisTask[] = [
    {
      id: 'overview',
      name: '项目概览',
      promptFile: 'overview-analysis.md',
      outputFile: 'docs/overview.md',
      priority: 1,
      description: '分析项目整体特征，提供快速理解项目的概览信息'
    },
    {
      id: 'systemArchitecture',
      name: '系统架构与组件设计',
      promptFile: 'system-architecture-analysis.md',
      outputFile: 'docs/system-architecture.md',
      priority: 2,
      description: '分析项目的整体架构设计、核心模式及组件结构'
    },
    {
      id: 'apiReference',
      name: 'API接口与数据模型',
      promptFile: 'api-reference-analysis.md',
      outputFile: 'docs/api-reference.md',
      priority: 3,
      description: '分析项目的API设计、接口规范及数据结构模型'
    },
    {
      id: 'businessWorkflows',
      name: '业务流程',
      promptFile: 'business-workflows-analysis.md',
      outputFile: 'docs/business-workflows.md',
      priority: 4,
      description: '分析项目的核心业务流程和处理逻辑'
    }
  ];

  /**
   * 执行知识库生成的主入口
   */
  async executeKnowledgeGeneration(config: AnalysisConfig): Promise<KnowledgeGenerationResult> {
    console.log('🚀 开始执行知识库生成...');
    console.log(`项目路径: ${config.repoPath}`);
    console.log(`输出路径: ${config.outputPath}`);
    console.log(`分析深度: ${config.depth}`);
    
    try {
      // 1. 构建统一的分析prompt
      console.log('📋 构建统一分析prompt...');
      const unifiedPrompt = await this.buildUnifiedPrompt(config);
      
      // 2. 执行单次SDK调用完成所有分析
      console.log('🔄 执行统一分析任务...');
      const analysisResult = await this.executeUnifiedAnalysis(unifiedPrompt, config);
      
      // 3. 解析分离各任务输出
      console.log('📊 解析分析结果...');
      const taskOutputs = await this.parseTaskOutputs(analysisResult, config);
      
      // 4. 质量检查
      console.log('🔍 执行质量检查...');
      const result = this.validateAndPackageResults(taskOutputs, config);
      
      // 5. 知识库更新
      console.log('💾 更新知识库文件...');
      await this.updateKnowledgeBase(result, config);
      
      console.log('✅ 知识库生成完成!');
      console.log(`整体置信度: ${(result.overallConfidence * 100).toFixed(1)}%`);
      console.log(`生成文件数: ${result.generatedFiles.length}`);
      
      return result;
    } catch (error) {
      console.error('❌ 知识库生成失败:', error);
      throw error;
    }
  }

  /**
   * 构建统一的分析prompt，基于模板文件
   */
  private async buildUnifiedPrompt(config: AnalysisConfig): Promise<string> {
    // 加载统一分析任务模板
    const unifiedTemplate = await this.loadPromptFile('unified-analysis-tasks.md');
    
    // 构建任务清单内容
    const taskListContent = await this.buildTaskListContent(config);
    
    // 替换模板占位符
    const unifiedPrompt = unifiedTemplate
      .replace(/\{\{REPO_PATH\}\}/g, config.repoPath)
      .replace(/\{\{ANALYSIS_DEPTH\}\}/g, config.depth)
      .replace(/\{\{INCLUDE_TESTS\}\}/g, config.includeTests.toString())
      .replace(/\{\{INCLUDE_DOCS\}\}/g, config.includeDocs.toString())
      .replace(/\{\{TASK_LIST\}\}/g, taskListContent);

    return unifiedPrompt;
  }

  /**
   * 构建任务清单内容
   */
  private async buildTaskListContent(config: AnalysisConfig): Promise<string> {
    const taskPrompts: string[] = [];
    
    // 先加载通用指导
    const commonGuide = await this.loadPromptFile('common-analysis-guide.md');
    
    for (const [index, task] of TaskListManager.ANALYSIS_TASKS.entries()) {
      try {
        const specificPrompt = await this.loadPromptFile(task.promptFile);
        
        // 组合通用指导和特定prompt
        const fullPrompt = this.combinePrompts(commonGuide, specificPrompt, config);
        
        const taskSection = `
### 任务 ${index + 1}: ${task.name}
**任务ID**: ${task.id}
**输出文件**: ${task.outputFile}
**描述**: ${task.description}

${fullPrompt}

---
`;
        
        taskPrompts.push(taskSection);
        console.log(`  ✅ 已加载任务: ${task.name}`);
      } catch (error) {
        console.warn(`  ⚠️ 跳过任务 ${task.name}:`, error);
      }
    }
    
    return taskPrompts.join('');
  }

  /**
   * 加载prompt文件（带缓存）
   */
  private async loadPromptFile(filename: string): Promise<string> {
    if (this.promptCache.has(filename)) {
      return this.promptCache.get(filename)!;
    }

    try {
      const currentDir = __dirname;
      const promptPath = path.resolve(currentDir, '..', 'prompts', filename);
      const content = await fs.readFile(promptPath, 'utf-8');
      
      this.promptCache.set(filename, content);
      return content;
    } catch (error) {
      throw new Error(`无法加载prompt文件: ${filename}`);
    }
  }

  /**
   * 组合通用指导和特定prompt
   */
  private combinePrompts(commonGuide: string, specificPrompt: string, config: AnalysisConfig): string {
    const customizedPrompt = specificPrompt
      .replace(/\{\{REPO_PATH\}\}/g, config.repoPath)
      .replace(/\{\{ANALYSIS_DEPTH\}\}/g, config.depth)
      .replace(/\{\{INCLUDE_TESTS\}\}/g, config.includeTests.toString())
      .replace(/\{\{INCLUDE_DOCS\}\}/g, config.includeDocs.toString())
      .replace(/\{\{OUTPUT_PATH\}\}/g, config.outputPath);

    return `${commonGuide}\n\n---\n\n${customizedPrompt}`;
  }

  /**
   * 执行统一的Claude分析
   */
  private async executeUnifiedAnalysis(prompt: string, config: AnalysisConfig): Promise<string> {
    console.log('🔄 开始统一分析，预计需要较长时间...');
    console.log('📈 启用详细日志和实时任务写入...');
    
    // 重置实时写入状态
    this.realtimeWrittenTasks.clear();
    
    // 实时任务处理状态
    let accumulatedContent = '';
    const taskBuffer = new Map<string, { content: string; startIndex: number }>();
    
    // 创建进度回调 - 支持实时任务检测和写入
    const progressCallback = {
      onThinkingStart: (sessionId: string) => {
        console.log(`🧠 ${TaskListManager.formatTimestamp()} Claude开始思考 (会话: ${sessionId.substring(0, 8)}...)`);
      },
      onThinkingProgress: (_content: string, totalLength: number) => {
        // 每500字符输出一次思考进展
        if (totalLength > 0 && totalLength % 500 === 0) {
          console.log(`💭 ${TaskListManager.formatTimestamp()} 思考进展: ${totalLength} 字符`);
        }
      },
      onToolExecution: (toolName: string, _toolUseId: string) => {
        console.log(`🔧 ${TaskListManager.formatTimestamp()} 执行工具: ${toolName}`);
      },
      onContentUpdate: async (partialContent: string, totalLength: number) => {
        // 累积内容用于实时解析
        accumulatedContent = partialContent;
        
        // 每1000字符输出一次进度
        if (totalLength > 0 && totalLength % 1000 === 0) {
          console.log(`📝 ${TaskListManager.formatTimestamp()} 内容更新: ${totalLength} 字符`);
        }
        
        // 检测并处理已完成的任务
        await this.detectAndWriteCompletedTasks(
          accumulatedContent, 
          taskBuffer, 
          config
        );
      },
      onStatusUpdate: (status: string, details?: any) => {
        console.log(`📊 ${TaskListManager.formatTimestamp()} 状态: ${status}`, details ? `(${JSON.stringify(details)})` : '');
      }
    };
    
    const result = await SDKHelper.executeAnalysis(
      prompt,
      '你是一个专业的代码仓库分析专家，擅长理解复杂的代码结构和业务逻辑。请按照指定的任务清单，对代码仓库进行全面深入的分析。',
      {
        // 不设置maxTurns，使用SDK默认值，避括undefined导致的问题
        timeout: 1000 * 60 * 60 * 2, // 2小时
        retryAttempts: 2,
        enablePartialResults: true,
        fallbackToSimplerPrompt: true,
        enableDetailedLogging: true,
        progressCallback: progressCallback
      }
    );
    
    // 分析完成后，进行最后一次任务检测
    console.log('🔍 执行最终任务检测...');
    await this.detectAndWriteCompletedTasks(result, taskBuffer, config);
    
    console.log(`✅ 实时写入完成，已处理任务: ${Array.from(this.realtimeWrittenTasks).join(', ')}`);
    return result;
  }

  /**
   * 检测并写入已完成的任务
   */
  private async detectAndWriteCompletedTasks(
    content: string,
    taskBuffer: Map<string, { content: string; startIndex: number }>,
    config: AnalysisConfig
  ): Promise<void> {
    for (const task of TaskListManager.ANALYSIS_TASKS) {
      if (this.realtimeWrittenTasks.has(task.id)) {
        continue; // 已处理的任务跳过
      }

      const startMarker = `=== TASK_START: ${task.id} ===`;
      const endMarker = `=== TASK_END: ${task.id} ===`;
      
      const startIndex = content.indexOf(startMarker);
      const endIndex = content.indexOf(endMarker);
      
      // 检测任务开始
      if (startIndex !== -1 && !taskBuffer.has(task.id)) {
        taskBuffer.set(task.id, { content: '', startIndex });
        console.log(`🎯 ${TaskListManager.formatTimestamp()} 检测到任务开始: ${task.name}`);
      }
      
      // 检测任务完成并立即写入
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        const taskContent = content
          .substring(startIndex + startMarker.length, endIndex)
          .trim();
        
        if (taskContent.length > 100) {
          try {
            await this.writeTaskImmediately(task, taskContent, config);
            this.realtimeWrittenTasks.add(task.id);
            taskBuffer.delete(task.id);
            
            console.log(`🎉 ${TaskListManager.formatTimestamp()} 任务实时写入成功: ${task.name} (${taskContent.length} 字符)`);
          } catch (error) {
            console.error(`❌ 任务实时写入失败: ${task.name}`, error);
          }
        } else {
          console.warn(`⚠️ ${TaskListManager.formatTimestamp()} 任务内容不足: ${task.name} (${taskContent.length} 字符)`);
        }
      }
    }
  }

  /**
   * 立即写入单个任务的文档
   */
  private async writeTaskImmediately(
    task: AnalysisTask,
    taskContent: string,
    config: AnalysisConfig
  ): Promise<void> {
    // 确保输出目录结构存在
    await this.ensureDirectoryStructure(config.outputPath);
    
    // 格式化文档内容
    const projectName = path.basename(config.repoPath);
    const formattedDocument = this.formatDocument(taskContent, task, projectName);
    
    // 写入文档文件
    const filePath = path.join(config.outputPath, '.repomind', task.outputFile);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, formattedDocument, 'utf-8');
    
    console.log(`  💾 实时写入: ${task.outputFile}`);
  }

  /**
   * 解析分离各任务的输出 - 作为兜底机制处理未实时写入的任务
   */
  private async parseTaskOutputs(analysisResult: string, config: AnalysisConfig): Promise<TaskOutput[]> {
    const taskOutputs: TaskOutput[] = [];
    
    // 为已实时写入的任务创建TaskOutput对象，读取实际文件内容
    for (const taskId of this.realtimeWrittenTasks) {
      const task = TaskListManager.ANALYSIS_TASKS.find(t => t.id === taskId);
      if (task) {
        try {
          // 读取已实时写入的文件内容
          const filePath = path.join(config.outputPath, '.repomind', task.outputFile);
          const actualContent = await fs.readFile(filePath, 'utf-8');
          const structuredData = SDKHelper.extractStructuredData(actualContent);
          
          taskOutputs.push({
            taskId: task.id,
            document: actualContent,
            metadata: {
              taskName: task.name,
              outputFile: task.outputFile,
              realtimeWritten: true,
              ...structuredData.metadata
            },
            references: structuredData.references
          });
          console.log(`  ✅ 已实时写入任务(已读取文件): ${task.name} (${actualContent.length} 字符)`);
        } catch (error) {
          console.error(`  ❌ 读取实时写入文件失败: ${task.name}`, error);
          // 创建错误标记的TaskOutput
          const errorMessage = error instanceof Error ? error.message : String(error);
          taskOutputs.push({
            taskId: task.id,
            document: `# ${task.name} - 文件读取失败\n\n实时写入的文件无法读取: ${errorMessage}`,
            metadata: {
              taskName: task.name,
              outputFile: task.outputFile,
              realtimeWritten: true,
              readError: true
            },
            references: []
          });
        }
      }
    }
    
    // 处理未实时写入的任务作为兜底
    const remainingTasks = TaskListManager.ANALYSIS_TASKS.filter(task => 
      !this.realtimeWrittenTasks.has(task.id)
    );
    
    if (remainingTasks.length > 0) {
      console.log(`🔧 兜底处理 ${remainingTasks.length} 个未实时写入的任务...`);
      
      for (const task of remainingTasks) {
        try {
          const taskContent = this.extractTaskContentForFallback(analysisResult, task);
          
          if (taskContent && taskContent.length > 100) {
            const structuredData = SDKHelper.extractStructuredData(taskContent);
            
            taskOutputs.push({
              taskId: task.id,
              document: this.formatDocument(taskContent, task, path.basename(config.repoPath)),
              metadata: {
                taskName: task.name,
                outputFile: task.outputFile,
                fallbackParsed: true,
                ...structuredData.metadata
              },
              references: structuredData.references
            });
            
            console.log(`  ✅ 兜底解析任务: ${task.name} (${taskContent.length} 字符)`);
          } else if (taskContent) {
            console.warn(`  ⚠️ 兜底任务内容不足: ${task.name} (${taskContent.length} 字符)`);
          } else {
            console.warn(`  ⚠️ 兜底未找到任务输出: ${task.name}`);
          }
        } catch (error) {
          console.error(`  ❌ 兜底解析失败: ${task.name}`, error);
        }
      }
    }
    
    return taskOutputs;
  }

  /**
   * 兜底机制的任务内容提取 - 使用多种策略
   */
  private extractTaskContentForFallback(analysisResult: string, task: AnalysisTask): string | null {
    // 策略1: 标准格式
    const standardResult = this.tryStandardFormat(analysisResult, task);
    if (standardResult) {
      console.log(`  🎯 兜底使用标准格式: ${task.name}`);
      return standardResult;
    }

    // 策略2: 变体格式
    const variantResult = this.tryVariantFormats(analysisResult, task);
    if (variantResult) {
      console.log(`  🎯 兜底使用变体格式: ${task.name}`);
      return variantResult;
    }

    // 策略3: 基于任务名称的模糊匹配
    const fuzzyResult = this.tryFuzzyMatching(analysisResult, task);
    if (fuzzyResult) {
      console.log(`  🎯 兜底使用模糊匹配: ${task.name}`);
      return fuzzyResult;
    }

    return null;
  }

  /**
   * 策略1: 标准格式解析
   */
  private tryStandardFormat(analysisResult: string, task: AnalysisTask): string | null {
    const startMarker = `=== TASK_START: ${task.id} ===`;
    const endMarker = `=== TASK_END: ${task.id} ===`;
    
    const startIndex = analysisResult.indexOf(startMarker);
    const endIndex = analysisResult.indexOf(endMarker);
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      return analysisResult
        .substring(startIndex + startMarker.length, endIndex)
        .trim();
    }
    
    return null;
  }

  /**
   * 策略2: 变体格式解析 (处理大小写、空格等变化)
   */
  private tryVariantFormats(analysisResult: string, task: AnalysisTask): string | null {
    const variants = [
      // 不同的分隔符样式
      [`=== TASK_START:${task.id} ===`, `=== TASK_END:${task.id} ===`],
      [`=== TASK_START: ${task.id}===`, `=== TASK_END: ${task.id}===`],
      [`===TASK_START: ${task.id} ===`, `===TASK_END: ${task.id} ===`],
      // 不同数量的等号
      [`== TASK_START: ${task.id} ==`, `== TASK_END: ${task.id} ==`],
      [`==== TASK_START: ${task.id} ====`, `==== TASK_END: ${task.id} ====`],
      // 使用中文冒号
      [`=== TASK_START：${task.id} ===`, `=== TASK_END：${task.id} ===`],
    ];
    
    for (const [startMarker, endMarker] of variants) {
      const startIndex = analysisResult.indexOf(startMarker);
      const endIndex = analysisResult.indexOf(endMarker);
      
      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        return analysisResult
          .substring(startIndex + startMarker.length, endIndex)
          .trim();
      }
    }
    
    return null;
  }

  /**
   * 策略3: 基于任务名称的模糊匹配
   */
  private tryFuzzyMatching(analysisResult: string, task: AnalysisTask): string | null {
    // 查找包含任务名称的标题或分隔符
    const patterns = [
      new RegExp(`#\\s*${task.name}([\\s\\S]*?)(?=#\\s*[^#\\s]|$)`, 'i'),
      new RegExp(`##\\s*${task.name}([\\s\\S]*?)(?=##\\s*[^#\\s]|$)`, 'i'),
      new RegExp(`###\\s*${task.name}([\\s\\S]*?)(?=###\\s*[^#\\s]|$)`, 'i'),
      new RegExp(`---\\s*${task.name}\\s*---([\\s\\S]*?)(?=---.*?---|$)`, 'i'),
    ];
    
    for (const pattern of patterns) {
      const match = analysisResult.match(pattern);
      if (match && match[1] && match[1].trim().length > 100) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  /**
   * 格式化文档输出
   */
  private formatDocument(content: string, task: AnalysisTask, projectName: string): string {
    const timestamp = TaskListManager.formatTimestamp();

    return `# ${task.name} - ${projectName}

${content}

---
*本文档由RepoMind系统自动生成于 ${timestamp}*  
*任务: ${task.name}*
`;
  }

  /**
   * 验证和打包结果
   */
  private validateAndPackageResults(taskOutputs: TaskOutput[], _config: AnalysisConfig): KnowledgeGenerationResult {
    const results: AnalysisResult[] = taskOutputs.map(output => ({
      agentName: output.taskId,
      status: 'success' as const,
      output: {
        document: output.document,
        metadata: output.metadata,
        references: output.references
      },
      executionTime: 0, // 无法精确计算单个任务时间
      confidence: this.calculateTaskConfidence(output)
    }));

    const overallConfidence = results.length > 0 
      ? results.reduce((sum, r) => sum + r.confidence, 0) / results.length 
      : 0;

    const generatedFiles = TaskListManager.ANALYSIS_TASKS.map(task => task.outputFile);

    return {
      status: results.length > 0 ? 'success' : 'error',
      results,
      overallConfidence,
      generatedFiles,
      metadata: {
        totalTasks: TaskListManager.ANALYSIS_TASKS.length,
        successfulTasks: results.length,
        averageExecutionTime: 0,
        timestamp: TaskListManager.formatTimestamp()
      }
    };
  }

  /**
   * 计算任务置信度
   */
  private calculateTaskConfidence(output: TaskOutput): number {
    const document = output.document;
    
    // 基于内容长度的置信度
    let confidence = Math.min(document.length / 2000, 1) * 0.4;
    
    // 检查文档结构
    if (document.includes('#') && document.includes('##')) confidence += 0.2;
    if (document.includes('```mermaid')) confidence += 0.1;
    if (document.includes('|') && document.includes('---')) confidence += 0.1; // 表格
    if (output.references.length > 0) confidence += 0.1;
    
    // 检查是否为部分结果
    if (document.includes('[注意：') || document.includes('分析因')) {
      confidence *= 0.7;
    }
    
    return Math.min(confidence, 1);
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
    
    // 写入各个分析结果文档（跳过已实时写入的任务）
    let writtenCount = 0;
    let skippedCount = 0;
    for (const analysisResult of result.results) {
      if (analysisResult.status === 'success') {
        // 检查是否为已实时写入的任务
        const isRealtimeWritten = analysisResult.output.metadata?.realtimeWritten;
        if (isRealtimeWritten) {
          skippedCount++;
          console.log(`  ⏭️ 跳过已实时写入: ${analysisResult.output.metadata.outputFile}`);
        } else {
          await this.writeTaskOutput(analysisResult, config.outputPath);
          writtenCount++;
        }
      }
    }
    console.log(`✅ 写入 ${writtenCount} 个分析文档${skippedCount > 0 ? `，跳过 ${skippedCount} 个已实时写入` : ''}`);
    
    console.log('🎉 知识库更新完成!');
  }

  /**
   * 确保目录结构存在
   */
  private async ensureDirectoryStructure(outputPath: string): Promise<void> {
    const directories = [
      '.repomind',
      '.repomind/meta',
      '.repomind/docs'
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
        name: path.basename(config.repoPath),
        path: config.repoPath,
        language: 'unknown',
        analysisDepth: config.depth,
        includeTests: config.includeTests
      },
      generatedAt: TaskListManager.formatTimestamp(),
      analysisConfig: config,
      contentIndex: {
        overview: './docs/overview.md',
        systemArchitecture: './docs/system-architecture.md',
        apiReference: './docs/api-reference.md',
        businessWorkflows: './docs/business-workflows.md'
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
   * 写入任务输出
   */
  private async writeTaskOutput(result: AnalysisResult, outputPath: string): Promise<void> {
    const task = TaskListManager.ANALYSIS_TASKS.find(t => t.id === result.agentName);
    if (!task) return;
    
    const filePath = path.join(outputPath, '.repomind', task.outputFile);
    
    // 确保父目录存在
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    
    // 写入文档内容
    await fs.writeFile(filePath, result.output.document, 'utf-8');
    console.log(`  ✍️ ${task.outputFile}`);
  }
}