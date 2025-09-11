/**
 * Claude Code SDK 调用优化工具
 * 统一管理SDK配置、错误处理和重试机制
 */

import { query } from "@anthropic-ai/claude-code";
import yaml from 'js-yaml';

interface QueryOptions {
  maxTurns?: number;
  allowedTools?: string[];
  disallowedTools?: string[];
  customSystemPrompt?: string;
  includePartialMessages?: boolean; // 启用部分消息流
  abortController?: AbortController; // 超时控制
  isFallbackQuery?: boolean; // 标记是否为降级查询
}

// 进度回调接口
export interface ProgressCallback {
  onThinkingStart?: (sessionId: string) => void;
  onThinkingProgress?: (content: string, totalLength: number) => void;
  onToolExecution?: (toolName: string, toolUseId: string) => void;
  onContentUpdate?: (partialContent: string, totalLength: number) => void;
  onStatusUpdate?: (status: string, details?: any) => void;
}

export interface SDKConfig {
  maxTurns?: number | undefined; // undefined表示不限制轮次
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enablePartialResults?: boolean; // 启用部分结果收集
  fallbackToSimplerPrompt?: boolean; // 失败时降级为简化prompt
  progressCallback?: ProgressCallback; // 进度回调
  enableDetailedLogging?: boolean; // 启用详细日志
}

export class SDKHelper {
  private static readonly DEFAULT_CONFIG: Required<Omit<SDKConfig, 'progressCallback'>> & { progressCallback?: ProgressCallback } = {
    maxTurns: undefined, // 注释掉轮次限制，让Claude Code有足够空间完成复杂分析
    timeout: 300000, // 5分钟
    retryAttempts: 3,
    retryDelay: 1000, // 1秒
    enablePartialResults: true,
    fallbackToSimplerPrompt: true,
    enableDetailedLogging: true // 默认启用详细日志，便于调试
  };

  /**
   * 执行Claude分析任务，包含错误处理、重试机制和降级策略
   */
  static async executeAnalysis(
    prompt: string,
    systemPrompt: string,
    config?: SDKConfig
  ): Promise<string> {
    // 只对未明确设置的配置项使用默认值，保持调用者的意图
    const mergedConfig = {
      // 只有在config中明确设置了maxTurns且不为undefined时才使用，否则使用默认值
      maxTurns: config && 'maxTurns' in config && config.maxTurns !== undefined ? config.maxTurns : this.DEFAULT_CONFIG.maxTurns,
      timeout: config?.timeout ?? this.DEFAULT_CONFIG.timeout,
      retryAttempts: config?.retryAttempts ?? this.DEFAULT_CONFIG.retryAttempts,
      retryDelay: config?.retryDelay ?? this.DEFAULT_CONFIG.retryDelay,
      enablePartialResults: config?.enablePartialResults ?? this.DEFAULT_CONFIG.enablePartialResults,
      fallbackToSimplerPrompt: config?.fallbackToSimplerPrompt ?? this.DEFAULT_CONFIG.fallbackToSimplerPrompt,
      progressCallback: config?.progressCallback,
      enableDetailedLogging: config?.enableDetailedLogging ?? this.DEFAULT_CONFIG.enableDetailedLogging
    };
    
    for (let attempt = 1; attempt <= mergedConfig.retryAttempts; attempt++) {
      try {
        if (mergedConfig.enableDetailedLogging) {
          console.log(`🔄 [${new Date().toISOString()}] 执行Claude分析 (尝试 ${attempt}/${mergedConfig.retryAttempts})`);
        } else {
          console.log(`🔄 执行Claude分析 (尝试 ${attempt}/${mergedConfig.retryAttempts})`);
        }
        
        mergedConfig.progressCallback?.onStatusUpdate?.('executing', { attempt, maxAttempts: mergedConfig.retryAttempts });
        
        const result = await this.performQuery(prompt, systemPrompt, {
          ...mergedConfig,
          progressCallback: mergedConfig.progressCallback
        } as any);
        
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
            // 如果是超时错误，适当延长超时时间；如果是maxTurns错误，保持原timeout
            const isTimeoutError = errorMessage.includes('超时') || 
                                 errorMessage.includes('AbortError') ||
                                 errorMessage.includes('Claude Code process aborted');
            
            const simplifiedConfig = {
              ...mergedConfig,
              // 只有在原本有maxTurns限制时才进行降级
              maxTurns: mergedConfig.maxTurns !== undefined 
                ? Math.max(15, Math.floor(mergedConfig.maxTurns * 0.6))
                : undefined,
              // 如果是超时错误，延长50%时间；否则保持原timeout
              timeout: isTimeoutError 
                ? Math.min(mergedConfig.timeout * 1.5, 900000) // 最多15分钟
                : mergedConfig.timeout,
              retryAttempts: 1, // 降级时只尝试一次
              fallbackToSimplerPrompt: false, // 避免无限递归降级
              enablePartialResults: false // 降级时不启用部分结果，以便失败时能正确抛出错误
            };
            
            const fallbackResult = await this.performQuery(simplifiedPrompt, systemPrompt, {
              ...simplifiedConfig,
              progressCallback: simplifiedConfig.progressCallback
            } as any);
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
                const partialResult = await this.performPartialQuery(prompt, systemPrompt, {
                  ...partialConfig,
                  progressCallback: partialConfig.progressCallback
                } as any);
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
    config: SDKConfig & { timeout: number; retryAttempts: number; retryDelay: number; enablePartialResults: boolean; fallbackToSimplerPrompt: boolean; enableDetailedLogging: boolean; progressCallback?: ProgressCallback }
  ): Promise<string> {
    // 创建AbortController用于超时控制
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, config.timeout);
    
    const queryOptions: QueryOptions = {
      // 部分结果查询时也完全移除maxTurns限制
      disallowedTools: [
        // 禁止写入工具（知识库分析期间不应修改文件）
        'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
        // 禁止联网工具（分析本地代码仓库）
        'WebFetch', 'WebSearch'
      ],
      customSystemPrompt: systemPrompt,
      includePartialMessages: config.enablePartialResults,
      abortController: abortController,
      isFallbackQuery: true // 标记为降级查询
    };

    try {
      const result = await this.runQuery(prompt, queryOptions, config.progressCallback, config.enableDetailedLogging);
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
    config: SDKConfig & { timeout: number; retryAttempts: number; retryDelay: number; enablePartialResults: boolean; fallbackToSimplerPrompt: boolean; enableDetailedLogging: boolean; progressCallback?: ProgressCallback }
  ): Promise<string> {
    // 创建AbortController用于超时控制
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, config.timeout);
    
    const queryOptions: QueryOptions = {
      // 完全移除maxTurns限制，让Claude Code自主决定所需轮次
      disallowedTools: [
        // 禁止写入工具（知识库分析期间不应修改文件）
        'Write', 'Edit', 'MultiEdit', 'NotebookEdit',
        // 禁止联网工具（分析本地代码仓库）
        'WebFetch', 'WebSearch'
      ],
      customSystemPrompt: systemPrompt,
      includePartialMessages: config.enablePartialResults,
      abortController: abortController,
      isFallbackQuery: false // 默认不是降级查询
    };

    try {
      const result = await this.runQuery(prompt, queryOptions, config.progressCallback, config.enableDetailedLogging);
      clearTimeout(timeoutId);
      return result;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * 执行查询并处理流式响应，支持部分结果收集和思考进度跟踪
   */
  private static async runQuery(prompt: string, options: QueryOptions, progressCallback?: ProgressCallback, enableDetailedLogging?: boolean): Promise<string> {
    let partialContent = '';
    let lastValidContent = '';
    let isThinking = false;
    let currentSessionId = '';
    let thinkingBuffer = ''; // 缓冲区用于累积完整句子
    
    try {
      for await (const message of query({
        prompt,
        options
      })) {
        // 处理流式事件
        if (message.type === 'stream_event') {
          const event = message.event;
          
          // 记录会话ID
          if (message.session_id && message.session_id !== currentSessionId) {
            currentSessionId = message.session_id;
            if (enableDetailedLogging) {
              console.log(`🔗 [${new Date().toISOString()}] 会话ID: ${currentSessionId}`);
            }
          }
          
          // 检查思考开始事件
          if (event.type === 'content_block_start' && event.content_block?.type === 'text') {
            isThinking = true;
            progressCallback?.onThinkingStart?.(currentSessionId);
            if (enableDetailedLogging) {
              console.log(`🧠 [${new Date().toISOString()}] 开始思考...`);
            }
          }
          
          // 检查工具执行事件
          if (event.type === 'tool_use_start' || (event.type === 'content_block_start' && event.content_block?.type === 'tool_use')) {
            const toolName = event.content_block?.name || 'unknown';
            const toolUseId = event.content_block?.id || message.parent_tool_use_id || 'unknown';
            progressCallback?.onToolExecution?.(toolName, toolUseId);
            if (enableDetailedLogging) {
              console.log(`🔧 [${new Date().toISOString()}] 执行工具: ${toolName} (ID: ${toolUseId})`);
            }
          }
          
          // 检查文本增量事件
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const deltaText = event.delta.text;
            partialContent += deltaText;
            
            // 如果在思考过程中，触发思考进度回调
            if (isThinking) {
              progressCallback?.onThinkingProgress?.(deltaText, partialContent.length);
              if (enableDetailedLogging && deltaText.trim()) {
                thinkingBuffer = this.processThinkingFragment(deltaText, thinkingBuffer, (completeThought: string) => {
                  console.log(`💭 [${new Date().toISOString()}] 思考内容: ${completeThought}`);
                });
              }
            }
            
            // 触发内容更新回调
            progressCallback?.onContentUpdate?.(partialContent, partialContent.length);
            
            // 如果内容看起来完整，保存为最后有效内容
            if (partialContent.length > 200) {
              lastValidContent = partialContent;
            }
          }
          
          // 检查内容块结束事件
          if (event.type === 'content_block_stop') {
            if (isThinking) {
              isThinking = false;
              // 输出剩余的思考内容
              if (enableDetailedLogging && thinkingBuffer.trim()) {
                console.log(`💭 [${new Date().toISOString()}] 思考内容: ${thinkingBuffer.trim()}`);
                thinkingBuffer = '';
              }
              if (enableDetailedLogging) {
                console.log(`🧠 [${new Date().toISOString()}] 思考完成，内容长度: ${partialContent.length}`);
              }
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

  /**
   * 处理思考片段，累积完整句子后输出
   */
  private static processThinkingFragment(
    deltaText: string, 
    buffer: string, 
    outputCallback: (completeThought: string) => void
  ): string {
    // 将新片段添加到缓冲区
    buffer += deltaText;
    
    // 定义句子结束标志
    const sentenceEnders = /[。！？；：\n]|\.(?:\s|$)|!(?:\s|$)|\?(?:\s|$)|;(?:\s|$)|:(?:\s|$)/g;
    
    let lastEndIndex = -1;
    let match;
    
    // 查找所有句子结束位置
    while ((match = sentenceEnders.exec(buffer)) !== null) {
      lastEndIndex = match.index + match[0].length;
    }
    
    // 如果找到完整句子，输出并清理缓冲区
    if (lastEndIndex > -1) {
      const completeThought = buffer.substring(0, lastEndIndex).trim();
      if (completeThought) {
        // 限制单次输出长度，避免过长的日志行
        const maxLength = 200;
        if (completeThought.length <= maxLength) {
          outputCallback(completeThought);
        } else {
          // 如果太长，按句子分割输出
          const sentences = completeThought.split(/([。！？；：])/);
          let currentSentence = '';
          
          for (let i = 0; i < sentences.length; i++) {
            currentSentence += sentences[i];
            
            // 如果是标点符号或达到长度限制，输出当前句子
            if (i % 2 === 1 || currentSentence.length > maxLength) {
              if (currentSentence.trim()) {
                outputCallback(currentSentence.trim());
                currentSentence = '';
              }
            }
          }
          
          // 输出剩余内容
          if (currentSentence.trim()) {
            outputCallback(currentSentence.trim());
          }
        }
      }
      
      // 保留未完成的部分
      buffer = buffer.substring(lastEndIndex);
    }
    // 如果缓冲区太长（超过500字符），强制输出并清空
    else if (buffer.length > 500) {
      const trimmedBuffer = buffer.trim();
      if (trimmedBuffer) {
        outputCallback(trimmedBuffer);
      }
      buffer = '';
    }
    
    return buffer;
  }
}