#!/usr/bin/env node
/**
 * RepoMind CLI 工具
 * 命令行界面，用于快速生成知识库
 */

import * as path from 'path';
import { program } from 'commander';
import { generateKnowledgeBase, VERSION } from './index';
import { directoryExists, detectProjectType } from './utils';

// 设置CLI程序信息
program
  .name('repomind')
  .description('RepoMind - 单仓库知识库AI Agent系统')
  .version(VERSION);

// 生成命令
program
  .command('generate')
  .alias('gen')
  .description('生成知识库')
  .option('-p, --path <path>', '项目路径', process.cwd())
  .option('-o, --output <path>', '输出路径 (默认为项目路径)')
  .option('-d, --depth <depth>', '分析深度 (shallow|normal|deep)', 'normal')
  .option('--no-tests', '不包含测试文件分析')
  .option('--no-docs', '不包含现有文档分析')
  .option('-c, --config <config>', '配置文件路径')
  .option('-v, --verbose', '显示详细日志')
  .action(async (options) => {
    try {
      console.log('🤖 RepoMind 知识库生成器');
      console.log(`版本: ${VERSION}\n`);

      // 验证项目路径
      const projectPath = path.resolve(options.path);
      if (!(await directoryExists(projectPath))) {
        console.error(`❌ 项目路径不存在: ${projectPath}`);
        process.exit(1);
      }

      // 检测项目类型
      const projectType = await detectProjectType(projectPath);
      console.log(`📁 项目路径: ${projectPath}`);
      console.log(`🔍 项目类型: ${projectType}`);

      // 构建配置
      const config = {
        repoPath: projectPath,
        outputPath: options.output || projectPath,
        depth: options.depth as 'shallow' | 'normal' | 'deep',
        includeTests: options.tests !== false,
        includeDocs: options.docs !== false
      };

      console.log(`⚙️ 分析深度: ${config.depth}`);
      console.log(`🧪 包含测试: ${config.includeTests ? '是' : '否'}`);
      console.log(`📚 包含文档: ${config.includeDocs ? '是' : '否'}`);
      console.log('');

      // 生成知识库
      const startTime = Date.now();
      await generateKnowledgeBase(config);
      const duration = Date.now() - startTime;

      console.log(`\n🎉 知识库生成完成！`);
      console.log(`⏱️ 总耗时: ${Math.round(duration / 1000)}s`);
      console.log(`📂 输出位置: ${path.join(config.outputPath, '.repomind')}`);

    } catch (error) {
      console.error('❌ 生成失败:', error);
      process.exit(1);
    }
  });

// 信息命令
program
  .command('info')
  .description('显示项目信息')
  .option('-p, --path <path>', '项目路径', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      
      if (!(await directoryExists(projectPath))) {
        console.error(`❌ 项目路径不存在: ${projectPath}`);
        process.exit(1);
      }

      console.log('📋 项目信息');
      console.log(`路径: ${projectPath}`);
      
      const projectType = await detectProjectType(projectPath);
      console.log(`类型: ${projectType}`);

      // 检查是否已有知识库
      const knowledgeBasePath = path.join(projectPath, '.repomind');
      const hasKnowledgeBase = await directoryExists(knowledgeBasePath);
      console.log(`知识库: ${hasKnowledgeBase ? '已存在' : '未生成'}`);

      if (hasKnowledgeBase) {
        try {
          const { readYamlFile } = await import('./utils');
          const knowledgeIndex = await readYamlFile(path.join(knowledgeBasePath, 'knowledge.yaml'));
          
          if (knowledgeIndex) {
            console.log(`生成时间: ${(knowledgeIndex as any).generatedAt}`);
            console.log(`整体置信度: ${((knowledgeIndex as any).qualityMetrics.overallConfidence * 100).toFixed(1)}%`);
          }
        } catch {
          console.log('知识库信息: 读取失败');
        }
      }

    } catch (error) {
      console.error('❌ 获取信息失败:', error);
      process.exit(1);
    }
  });

// 清理命令
program
  .command('clean')
  .description('清理生成的知识库文件')
  .option('-p, --path <path>', '项目路径', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      const knowledgeBasePath = path.join(projectPath, '.repomind');

      if (!(await directoryExists(knowledgeBasePath))) {
        console.log('📂 没有找到知识库文件，无需清理');
        return;
      }

      const { promises: fs } = await import('fs');
      await fs.rmdir(knowledgeBasePath, { recursive: true });
      console.log('🗑️ 知识库文件已清理');

    } catch (error) {
      console.error('❌ 清理失败:', error);
      process.exit(1);
    }
  });

// 验证命令
program
  .command('validate')
  .description('验证知识库质量')
  .option('-p, --path <path>', '项目路径', process.cwd())
  .action(async (options) => {
    try {
      const projectPath = path.resolve(options.path);
      const knowledgeBasePath = path.join(projectPath, '.repomind');

      if (!(await directoryExists(knowledgeBasePath))) {
        console.error('❌ 未找到知识库，请先运行 generate 命令');
        process.exit(1);
      }

      console.log('🔍 验证知识库质量...');

      // 读取知识库索引
      const { readYamlFile } = await import('./utils');
      const knowledgeIndex = await readYamlFile(path.join(knowledgeBasePath, 'knowledge.yaml'));

      if (!knowledgeIndex) {
        console.error('❌ 无法读取知识库索引文件');
        process.exit(1);
      }

      const index = knowledgeIndex as any;
      console.log(`📊 整体置信度: ${(index.qualityMetrics.overallConfidence * 100).toFixed(1)}%`);
      console.log(`✅ 成功任务: ${index.qualityMetrics.successfulTasks}/${index.qualityMetrics.totalTasks}`);

      // 检查必要文件
      const requiredFiles = [
        'docs/overview.md',
        'docs/architecture.md', 
        'docs/components.md'
      ];

      let missingFiles = 0;
      for (const file of requiredFiles) {
        const filePath = path.join(knowledgeBasePath, file);
        const { fileExists } = await import('./utils');
        
        if (!(await fileExists(filePath))) {
          console.warn(`⚠️ 缺少文件: ${file}`);
          missingFiles++;
        }
      }

      if (missingFiles === 0) {
        console.log('✅ 所有必要文件都存在');
      }

      // 质量评级
      const confidence = index.qualityMetrics.overallConfidence;
      let grade: string;
      if (confidence >= 0.9) grade = 'A (优秀)';
      else if (confidence >= 0.8) grade = 'B (良好)';
      else if (confidence >= 0.7) grade = 'C (一般)';
      else if (confidence >= 0.6) grade = 'D (及格)';
      else grade = 'F (不及格)';

      console.log(`📈 质量评级: ${grade}`);

    } catch (error) {
      console.error('❌ 验证失败:', error);
      process.exit(1);
    }
  });

// 更新命令
program
  .command('update')
  .description('增量更新知识库')
  .option('-p, --path <path>', '项目路径', process.cwd())
  .action(async (_options) => {
    try {
      console.log('🔄 增量更新功能开发中...');
      console.log('目前请使用 generate 命令重新生成知识库');
      
      // TODO: 实现增量更新逻辑
      // 1. 检测文件变更
      // 2. 分析影响范围
      // 3. 只更新相关部分
      
    } catch (error) {
      console.error('❌ 更新失败:', error);
      process.exit(1);
    }
  });

// 帮助信息
program
  .command('help')
  .description('显示帮助信息')
  .action(() => {
    console.log(`
🤖 RepoMind - 单仓库知识库AI Agent系统

常用命令：
  repomind generate [options]     生成知识库
  repomind info [options]         显示项目信息
  repomind validate [options]     验证知识库质量
  repomind clean [options]        清理知识库文件

示例：
  repomind generate                          # 为当前目录生成知识库
  repomind generate -p ./my-project         # 为指定项目生成知识库
  repomind generate -d deep --no-tests      # 深度分析，不包含测试文件
  repomind info                             # 查看当前项目信息
  repomind validate                         # 验证知识库质量

更多信息：
  repomind --help                           # 显示完整帮助
  repomind <command> --help                 # 显示特定命令帮助
`);
  });

// 解析命令行参数
if (require.main === module) {
  program.parse();
}