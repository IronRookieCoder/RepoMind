/**
 * 知识库查询工具
 * 基于knowledge.yaml索引结构的智能查询实现
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { KnowledgeIndex } from '../types';
import { SearchResult, KnowledgeBaseResult } from './types';

export class KnowledgeQueryTool {
  /**
   * 加载知识库索引
   */
  static async loadKnowledgeIndex(repoPath: string): Promise<KnowledgeIndex | null> {
    const indexPath = path.join(repoPath, '.repomind', 'knowledge.yaml');
    
    try {
      const content = await fs.readFile(indexPath, 'utf-8');
      return yaml.load(content) as KnowledgeIndex;
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查知识库是否存在
   */
  static async hasKnowledgeBase(repoPath: string): Promise<boolean> {
    const index = await this.loadKnowledgeIndex(repoPath);
    return index !== null;
  }

  /**
   * 智能搜索知识库内容
   */
  static async searchKnowledge(
    repoPath: string, 
    query: string, 
    type: 'overview' | 'systemArchitecture' | 'apiReference' | 'businessWorkflows' | 'all' = 'all',
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    const knowledgeIndex = await this.loadKnowledgeIndex(repoPath);
    if (!knowledgeIndex) {
      throw new Error(`知识库不存在: ${repoPath}`);
    }

    const results: SearchResult[] = [];
    const searchableTypes = type === 'all' 
      ? ['overview', 'systemArchitecture', 'apiReference', 'businessWorkflows'] as const
      : [type];

    // 在指定文档类型中搜索
    for (const docType of searchableTypes) {
      const docPath = knowledgeIndex.contentIndex[docType];
      const fullPath = path.join(repoPath, docPath);
      
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const searchResults = await this.searchInDocument(content, query, docType, docPath, repoPath);
        results.push(...searchResults);
      } catch (error) {
        // 文档不存在或无法读取，跳过
        console.warn(`无法读取文档: ${fullPath}`);
      }
    }

    // 按相关性排序并限制结果数量
    return results
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, maxResults);
  }

  /**
   * 在单个文档中搜索
   */
  private static async searchInDocument(
    content: string, 
    query: string, 
    docType: 'overview' | 'systemArchitecture' | 'apiReference' | 'businessWorkflows',
    docPath: string,
    repoPath: string
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const lines = content.split('\n');
    const repoId = path.basename(repoPath);

    // 按段落搜索（以标题为分界）
    let currentSection = '';
    let currentContent: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 检测标题行
      if (line.startsWith('#')) {
        // 处理上一个段落
        if (currentContent.length > 0 && currentSection) {
          const sectionText = currentContent.join('\n');
          const relevance = this.calculateDetailedRelevance(sectionText, query);
          
          if (relevance > 0.1) {
            results.push({
              repoId,
              filePath: docPath,
              content: this.extractRelevantContent(sectionText, query),
              relevance,
              type: docType,
              section: currentSection
            });
          }
        }
        
        // 开始新段落
        currentSection = line.replace(/^#+\s*/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // 处理最后一个段落
    if (currentContent.length > 0 && currentSection) {
      const sectionText = currentContent.join('\n');
      const relevance = this.calculateDetailedRelevance(sectionText, query);
      
      if (relevance > 0.1) {
        results.push({
          repoId,
          filePath: docPath,
          content: this.extractRelevantContent(sectionText, query),
          relevance,
          type: docType,
          section: currentSection
        });
      }
    }

    return results;
  }

  /**
   * 计算详细的相关性得分
   */
  private static calculateDetailedRelevance(content: string, query: string): number {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
    const contentWords = contentLower.split(/\s+/);
    
    let totalScore = 0;
    
    for (const queryWord of queryWords) {
      let wordScore = 0;
      
      // 精确匹配得分最高
      if (contentLower.includes(queryWord)) {
        wordScore += 1.0;
      }
      
      // 部分匹配
      const partialMatches = contentWords.filter(word => word.includes(queryWord));
      wordScore += partialMatches.length * 0.5;
      
      // 相近匹配（编辑距离）
      const similarWords = contentWords.filter(word => 
        this.calculateEditDistance(word, queryWord) <= 2 && word.length >= queryWord.length - 1
      );
      wordScore += similarWords.length * 0.3;
      
      totalScore += Math.min(wordScore, 2.0); // 单词得分上限
    }
    
    return Math.min(totalScore / queryWords.length, 1.0);
  }

  /**
   * 提取相关内容片段
   */
  private static extractRelevantContent(content: string, query: string, maxLength: number = 500): string {
    const queryLower = query.toLowerCase();
    const lines = content.split('\n');
    const relevantLines: string[] = [];
    
    // 找到包含查询词的行及其上下文
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes(queryLower)) {
        // 添加上下文（前后各2行）
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        
        for (let j = start; j < end; j++) {
          if (!relevantLines.includes(lines[j]) && lines[j].trim()) {
            relevantLines.push(lines[j]);
          }
        }
      }
    }
    
    let result = relevantLines.join('\n');
    
    // 如果内容太长，截断
    if (result.length > maxLength) {
      result = result.substring(0, maxLength) + '...';
    }
    
    return result || content.substring(0, maxLength);
  }

  /**
   * 计算编辑距离
   */
  private static calculateEditDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * 获取完整知识库结构
   */
  static async getKnowledgeBase(repoPath: string): Promise<KnowledgeBaseResult> {
    const knowledgeIndex = await this.loadKnowledgeIndex(repoPath);
    if (!knowledgeIndex) {
      throw new Error(`知识库不存在: ${repoPath}`);
    }

    return {
      repoId: path.basename(repoPath),
      knowledgeIndex,
      contentIndex: knowledgeIndex.contentIndex,
      qualityMetrics: knowledgeIndex.qualityMetrics
    };
  }

  /**
   * 获取文档内容
   */
  static async getDocument(
    repoPath: string, 
    documentType: 'overview' | 'systemArchitecture' | 'apiReference' | 'businessWorkflows'
  ): Promise<{ filePath: string; content: string; lastModified: string; size: number }> {
    const knowledgeIndex = await this.loadKnowledgeIndex(repoPath);
    if (!knowledgeIndex) {
      throw new Error(`知识库不存在: ${repoPath}`);
    }

    const docPath = knowledgeIndex.contentIndex[documentType];
    const fullPath = path.join(repoPath, docPath);

    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const stats = await fs.stat(fullPath);
      
      return {
        filePath: docPath,
        content,
        lastModified: stats.mtime.toISOString(),
        size: stats.size
      };
    } catch (error) {
      throw new Error(`无法读取文档: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}