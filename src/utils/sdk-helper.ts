/**
 * Claude Code SDK 调用优化工具
 * 统一管理SDK配置、错误处理和重试机制
 */

import { query } from "@anthropic-ai/claude-code";
import yaml from 'js-yaml';

interface QueryOptions {
  maxTurns?: number;
  allowedTools?: string[];
  customSystemPrompt?: string;
  includePartialMessages?: boolean; // 启用部分消息流
  abortController?: AbortController; // 超时控制
  isFallbackQuery?: boolean; // 标记是否为降级查询
}

export interface SDKConfig {
  maxTurns?: number;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enablePartialResults?: boolean; // 启用部分结果收集
  fallbackToSimplerPrompt?: boolean; // 失败时降级为简化prompt
}

export class SDKHelper {
  private static readonly DEFAULT_CONFIG: Required<SDKConfig> = {
    maxTurns: 20,
    timeout: 300000, // 5分钟
    retryAttempts: 3,
    retryDelay: 1000, // 1秒
    enablePartialResults: true,
    fallbackToSimplerPrompt: true
  };

  /**
   * 执行Claude分析任务，包含错误处理、重试机制和降级策略
   */
  static async executeAnalysis(
    prompt: string,
    systemPrompt: string,
    config?: SDKConfig
  ): Promise<string> {
    const mergedConfig = { ...this.DEFAULT_CONFIG, ...config };
    
    for (let attempt = 1; attempt <= mergedConfig.retryAttempts; attempt++) {
      try {
        console.log(`🔄 执行Claude分析 (尝试 ${attempt}/${mergedConfig.retryAttempts})`);
        
        const result = await this.performQuery(prompt, systemPrompt, mergedConfig);
        
        if (result && result.length > 100) {
          console.log('✅ Claude分析成功完成');
          return result;
        } else {
          throw new Error('分析结果内容不足');
        }
        
      } catch (error) {
        const errorMessage = (error as Error).message;
        console.warn(`⚠️ 尝试 ${attempt} 失败:`, error);
        
        // 如果是maxTurns或超时错误，且启用了降级策略，尝试简化prompt
        const isLimitError = errorMessage.includes('达到最大对话轮次') || 
                           errorMessage.includes('最大对话轮次') ||
                           errorMessage.includes('超时') || 
                           errorMessage.includes('AbortError') ||
                           errorMessage.includes('Claude Code process aborted');
        
        // 在第一次遇到限制错误时就尝试降级，而不是等到最后一次重试
        if (isLimitError && mergedConfig.fallbackToSimplerPrompt && attempt >= 1) {
          console.log(`🔄 检测到限制错误，尝试降级分析策略... (错误: ${errorMessage})`);
          try {
            const simplifiedPrompt = this.createSimplifiedPrompt(prompt);
            const simplifiedConfig = {
              ...mergedConfig,
              maxTurns: Math.max(10, mergedConfig.maxTurns * 2), // 增加maxTurns而不是减少
              timeout: Math.max(120000, mergedConfig.timeout), // 保持或增加timeout
              retryAttempts: 1, // 降级时只尝试一次
              fallbackToSimplerPrompt: false, // 避免无限递归降级
              enablePartialResults: false // 降级时不启用部分结果，以便失败时能正确抛出错误
            };
            
            const fallbackResult = await this.performQuery(simplifiedPrompt, systemPrompt, simplifiedConfig);
            if (fallbackResult && fallbackResult.length > 50) {
              console.log('✅ 降级分析成功完成');
              return fallbackResult + '\n\n[注意：这是简化版分析结果]';
            }
          } catch (fallbackError) {
            console.warn('降级分析也失败了:', fallbackError);
            // 如果降级也失败了，最后尝试用原始配置获取部分结果
            if (mergedConfig.enablePartialResults) {
              console.log('🔄 降级失败，尝试获取部分结果...');
              try {
                const partialConfig = {
                  ...mergedConfig,
                  enablePartialResults: true,
                  fallbackToSimplerPrompt: false // 避免无限递归
                };
                // 使用特殊的查询方法标记为降级查询
                const partialResult = await this.performPartialQuery(prompt, systemPrompt, partialConfig);
                if (partialResult && partialResult.length > 50) {
                  console.log('✅ 成功获取部分结果');
                  return partialResult + '\n\n[注意：分析未完全完成，这是部分结果]';
                }
              } catch (partialError) {
                console.warn('获取部分结果也失败了:', partialError);
              }
            }
          }
        }
        
        if (attempt === mergedConfig.retryAttempts) {
          console.error('❌ 所有重试尝试失败');
          throw new Error(`Claude分析失败: ${errorMessage}`);
        }
        
        // 等待后重试
        await this.delay(mergedConfig.retryDelay * attempt);
      }
    }
    
    throw new Error('分析执行失败');
  }

  /**
   * 执行用于获取部分结果的查询，标记为降级查询
   */
  private static async performPartialQuery(
    prompt: string, 
    systemPrompt: string,
    config: Required<SDKConfig>
  ): Promise<string> {
    // 创建AbortController用于超时控制
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, config.timeout);
    
    const queryOptions: QueryOptions = {
      maxTurns: config.maxTurns,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Task', 'ExitPlanMode', 'TodoWrite', 'WebFetch', 'WebSearch', 'BashOutput', 'KillBash'],
      customSystemPrompt: systemPrompt,
      includePartialMessages: config.enablePartialResults,
      abortController: abortController,
      isFallbackQuery: true // 标记为降级查询
    };

    try {
      const result = await this.runQuery(prompt, queryOptions);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 执行单次Claude查询，使用AbortController进行超时控制
   */
  private static async performQuery(
    prompt: string, 
    systemPrompt: string,
    config: Required<SDKConfig>
  ): Promise<string> {
    // 创建AbortController用于超时控制
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, config.timeout);
    
    const queryOptions: QueryOptions = {
      maxTurns: config.maxTurns,
      allowedTools: ['Read', 'Glob', 'Grep', 'Bash', 'Task', 'ExitPlanMode', 'TodoWrite', 'WebFetch', 'WebSearch', 'BashOutput', 'KillBash'],
      customSystemPrompt: systemPrompt,
      includePartialMessages: config.enablePartialResults,
      abortController: abortController,
      isFallbackQuery: false // 默认不是降级查询
    };

    try {
      const result = await this.runQuery(prompt, queryOptions);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 执行查询并处理流式响应，支持部分结果收集
   */
  private static async runQuery(prompt: string, options: QueryOptions): Promise<string> {
    let partialContent = '';
    let lastValidContent = '';
    
    try {
      for await (const message of query({
        prompt,
        options
      })) {
        // 收集流式部分消息
        if (message.type === 'stream_event') {
          const event = message.event;
          // 检查是否为文本增量事件
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            partialContent += event.delta.text;
            // 如果内容看起来完整（超过一定长度），保存为最后有效内容
            if (partialContent.length > 200) {
              lastValidContent = partialContent;
            }
          }
        }
        
        // 处理成功结果
        if (message.type === 'result' && message.subtype === 'success') {
          return message.result;
        }
        
        // 处理各种错误情况，但尝试返回部分结果
        if (message.type === 'result') {
          if (message.subtype === 'error_max_turns') {
            // 如果是降级查询且有部分内容，直接返回部分结果
            if (options.isFallbackQuery && options.includePartialMessages && lastValidContent) {
              console.warn('降级查询达到最大轮次限制，返回部分结果');
              return lastValidContent + '\n\n[注意：降级分析因达到最大轮次限制而截断]';
            }
            // 否则抛出错误以触发降级策略
            throw new Error('达到最大对话轮次限制，请简化您的分析任务或拆分为多个小任务');
          }
          if (message.subtype === 'error_during_execution') {
            if (lastValidContent && options.includePartialMessages) {
              console.warn('执行错误，返回部分结果');
              return lastValidContent + '\n\n[注意：分析因执行错误而中断]';
            }
            throw new Error('执行过程中发生错误，请检查输入参数和系统配置');
          }
          if (message.subtype === 'cancelled') {
            if (lastValidContent && options.includePartialMessages) {
              console.warn('查询被取消，返回部分结果');
              return lastValidContent + '\n\n[注意：分析被用户取消]';
            }
            throw new Error('查询被取消');
          }
          // 其他错误类型的通用处理
          if (lastValidContent && options.includePartialMessages) {
            console.warn(`查询错误(${message.subtype})，返回部分结果`);
            return lastValidContent + `\n\n[注意：分析因错误(${message.subtype})而中断]`;
          }
          throw new Error(`Claude查询错误: ${message.subtype}`);
        }
      }
    } catch (error) {
      // 如果是AbortController导致的超时，且有部分内容，返回部分结果
      if (error instanceof Error && error.name === 'AbortError' && lastValidContent && options.includePartialMessages) {
        console.warn('查询超时，返回部分结果');
        return lastValidContent + '\n\n[注意：分析因超时而截断]';
      }
      throw error;
    }
    
    // 如果没有收到任何结果但有部分内容，返回部分内容
    if (lastValidContent && options.includePartialMessages) {
      console.warn('未收到完整响应，返回部分结果');
      return lastValidContent + '\n\n[注意：分析未完全完成]';
    }
    
    throw new Error('未收到有效的Claude响应');
  }


  /**
   * 创建简化版prompt用于降级分析
   */
  private static createSimplifiedPrompt(originalPrompt: string): string {
    // 通用精简策略：减少分析深度，专注核心信息
    const simplified = `请对以下内容进行简要分析，专注最关键的信息：
    
${originalPrompt}

请提供精简的分析结果，限制输出长度，避免详细展开。`;

    return simplified;
  }

  /**
   * 延迟函数
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 验证分析结果质量
   */
  static validateResult(result: string, minLength: number = 500): boolean {
    if (!result || result.trim().length < minLength) {
      return false;
    }
    
    // 检查是否包含明显的错误信息
    const errorPatterns = [
      /错误|Error|失败|Failed/i,
      /无法|Cannot|Unable/i,
      /不存在|Not found|Does not exist/i
    ];
    
    const hasErrors = errorPatterns.some(pattern => pattern.test(result));
    
    return !hasErrors;
  }

  /**
   * 从分析结果中安全提取结构化数据
   */
  static extractStructuredData(content: string): {
    techStack: string[];
    references: string[];
    metadata: Record<string, any>;
  } {
    try {
      // 尝试从特定标记中提取结构化数据
      // 支持YAML和JSON两种格式
      let structuredMatch = content.match(/```yaml\n(.*?)\n```/s);
      if (structuredMatch) {
        const parsed = yaml.load(structuredMatch[1]) as any;
        return {
          techStack: parsed?.techStack || [],
          references: parsed?.references || [],
          metadata: parsed?.metadata || {}
        };
      }
      
      // 倒退为JSON格式
      structuredMatch = content.match(/```json\n(.*?)\n```/s);
      if (structuredMatch) {
        const parsed = JSON.parse(structuredMatch[1]);
        return {
          techStack: parsed.techStack || [],
          references: parsed.references || [],
          metadata: parsed.metadata || {}
        };
      }
    } catch (error) {
      console.warn('解析结构化数据失败:', error);
    }
    
    // 返回默认值
    return {
      techStack: [],
      references: [],
      metadata: {}
    };
  }
}