/**
 * RepoMind 工具函数
 */

import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'js-yaml';

/**
 * 检查目录是否存在
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * 检查文件是否存在
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * 确保目录存在，如果不存在则创建
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  if (!(await directoryExists(dirPath))) {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * 检查是否为Git仓库
 */
export async function isGitRepository(repoPath: string): Promise<boolean> {
  const gitPath = path.join(repoPath, '.git');
  return await directoryExists(gitPath);
}

/**
 * 获取项目类型（基于文件特征）
 */
export async function detectProjectType(repoPath: string): Promise<string> {
  const indicators = [
    { file: 'package.json', type: 'javascript/typescript' },
    { file: 'Cargo.toml', type: 'rust' },
    { file: 'go.mod', type: 'go' },
    { file: 'pom.xml', type: 'java-maven' },
    { file: 'build.gradle', type: 'java-gradle' },
    { file: 'requirements.txt', type: 'python' },
    { file: 'setup.py', type: 'python' },
    { file: 'Gemfile', type: 'ruby' },
    { file: 'composer.json', type: 'php' },
    { file: 'Dockerfile', type: 'containerized' }
  ];

  for (const indicator of indicators) {
    const filePath = path.join(repoPath, indicator.file);
    if (await fileExists(filePath)) {
      return indicator.type;
    }
  }

  return 'unknown';
}

/**
 * 读取并解析JSON文件
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * 读取并解析YAML文件
 */
export async function readYamlFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return yaml.load(content) as T;
  } catch {
    return null;
  }
}

/**
 * 写入JSON文件
 */
export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 写入YAML文件
 */
export async function writeYamlFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  const yamlContent = yaml.dump(data, { 
    indent: 2, 
    lineWidth: -1, 
    noRefs: true,
    sortKeys: false
  });
  await fs.writeFile(filePath, yamlContent, 'utf-8');
}

/**
 * 递归获取目录中的所有文件
 */
export async function getAllFiles(
  dirPath: string, 
  extensions?: string[], 
  excludePatterns?: RegExp[]
): Promise<string[]> {
  const files: string[] = [];
  
  const processDirectory = async (currentPath: string) => {
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const itemPath = path.join(currentPath, item);
        const stats = await fs.lstat(itemPath);
        
        if (stats.isDirectory()) {
          // 跳过一些常见的无关目录
          if (item.startsWith('.') && item !== '.repomind') continue;
          if (['node_modules', 'target', 'dist', 'build', '__pycache__'].includes(item)) continue;
          
          await processDirectory(itemPath);
        } else if (stats.isFile()) {
          const relativePath = path.relative(dirPath, itemPath);
          
          // 检查排除模式
          if (excludePatterns && excludePatterns.some(pattern => pattern.test(relativePath))) {
            continue;
          }
          
          // 检查扩展名
          if (extensions) {
            const ext = path.extname(item).toLowerCase();
            if (!extensions.includes(ext)) continue;
          }
          
          files.push(relativePath);
        }
      }
    } catch (error) {
      console.warn(`无法处理目录 ${currentPath}:`, error);
    }
  };
  
  await processDirectory(dirPath);
  return files.sort();
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 清理和规范化文本内容
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')  // 统一换行符
    .replace(/\t/g, '  ')    // 将制表符转为空格
    .trim();                 // 去除首尾空白
}

/**
 * 提取Markdown中的代码块
 */
export function extractCodeBlocks(markdown: string): Array<{ language: string; code: string }> {
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const blocks: Array<{ language: string; code: string }> = [];
  
  let match;
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }
  
  return blocks;
}

/**
 * 生成简单的哈希值（用于文件变更检测）
 */
export function simpleHash(content: string): string {
  let hash = 0;
  if (content.length === 0) return hash.toString();
  
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 转换为32位整数
  }
  
  return Math.abs(hash).toString(36);
}

/**
 * 安全地解析JSON字符串
 */
export function safeJsonParse<T>(jsonString: string, defaultValue: T): T {
  try {
    return JSON.parse(jsonString) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 延迟执行函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试执行函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries) {
        console.warn(`尝试 ${attempt} 失败，${delayMs}ms 后重试:`, error);
        await delay(delayMs * attempt); // 指数退避
      }
    }
  }
  
  throw new Error(`所有 ${maxRetries} 次尝试都失败了。最后错误: ${lastError?.message || '未知错误'}`);
}