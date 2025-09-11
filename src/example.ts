/**
 * RepoMind 使用示例
 * 展示如何使用单仓库知识库AI Agent系统
 */

import { 
  AgentScheduler, 
  generateKnowledgeBase,
  AnalysisConfig
} from './index';

/**
 * 基础使用示例
 */
async function basicExample() {
  console.log('=== 基础使用示例 ===');
  
  try {
    // 使用便捷函数生成知识库
    await generateKnowledgeBase({
      repoPath: process.cwd(), // 当前项目目录
      depth: 'normal'
    });
    
    console.log('✅ 知识库生成完成！');
    console.log('📂 请查看 .repomind 目录中的生成文件');
    
  } catch (error) {
    console.error('❌ 生成失败:', error);
  }
}

/**
 * 高级配置示例
 */
async function advancedExample() {
  console.log('=== 高级配置示例 ===');
  
  const config: AnalysisConfig = {
    repoPath: process.cwd(),
    outputPath: process.cwd(),
    depth: 'deep', // 深度分析
    includeTests: true,
    includeDocs: true,
    customPatterns: {
      // 自定义模式匹配
      'services': ['**/*Service.ts', '**/*service.js', '**/services/**'],
      'controllers': ['**/*Controller.ts', '**/controllers/**'],
      'models': ['**/*Model.ts', '**/models/**', '**/entities/**'],
      'utils': ['**/*util.ts', '**/utils/**', '**/helpers/**']
    }
  };

  const scheduler = new AgentScheduler(2); // 最多2个并发任务
  
  try {
    const result = await scheduler.executeKnowledgeGeneration(config);
    
    console.log('🎯 生成结果:');
    console.log(`  状态: ${result.status}`);
    console.log(`  整体置信度: ${(result.overallConfidence * 100).toFixed(1)}%`);
    console.log(`  生成文件: ${result.generatedFiles.length} 个`);
    console.log(`  平均执行时间: ${result.metadata.averageExecutionTime.toFixed(0)}ms`);
    
    // 显示每个Agent的结果
    console.log('\n📋 详细结果:');
    result.results.forEach(agentResult => {
      const statusIcon = agentResult.status === 'success' ? '✅' : 
                        agentResult.status === 'partial' ? '⚠️' : '❌';
      console.log(`  ${statusIcon} ${agentResult.agentName}: ${agentResult.status} (${(agentResult.confidence * 100).toFixed(1)}%)`);
    });
    
    // 显示警告（如果有）
    if (result.metadata.warnings) {
      console.log('\n⚠️ 警告:');
      result.metadata.warnings.forEach(warning => {
        console.log(`  - ${warning}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 生成失败:', error);
  }
}

/**
 * 自定义项目分析示例
 */
async function customProjectExample() {
  console.log('=== 自定义项目分析示例 ===');
  
  const projectPath = '/path/to/your/project';
  
  // 检查项目是否存在
  const fs = await import('fs');
  if (!fs.existsSync(projectPath)) {
    console.log('⚠️ 请修改 projectPath 为实际的项目路径');
    return;
  }
  
  const config: AnalysisConfig = {
    repoPath: projectPath,
    outputPath: projectPath,
    depth: 'normal',
    includeTests: false, // 不包含测试文件
    includeDocs: true,
    customPatterns: {
      // 针对特定项目类型的模式
      'react-components': ['**/components/**/*.tsx', '**/components/**/*.jsx'],
      'vue-components': ['**/components/**/*.vue'],
      'api-routes': ['**/routes/**', '**/api/**'],
      'database': ['**/migrations/**', '**/models/**', '**/schemas/**']
    }
  };

  try {
    await generateKnowledgeBase(config);
    
    console.log('🎉 自定义项目分析完成！');
    console.log(`📁 知识库文件已保存到: ${projectPath}/.repomind/`);
    
  } catch (error) {
    console.error('❌ 分析失败:', error);
  }
}

/**
 * 批量分析多个项目示例
 */
async function batchAnalysisExample() {
  console.log('=== 批量分析示例 ===');
  
  const projects = [
    '/path/to/project1',
    '/path/to/project2',
    '/path/to/project3'
  ];
  
  console.log('⚠️ 请修改项目路径为实际路径');
  
  for (let i = 0; i < projects.length; i++) {
    const projectPath = projects[i];
    console.log(`\n[${i + 1}/${projects.length}] 分析项目: ${projectPath}`);
    
    try {
      // 为每个项目使用相同的配置
      await generateKnowledgeBase({
        repoPath: projectPath,
        depth: 'normal',
        includeTests: true,
        includeDocs: true
      });
      
      console.log(`✅ 项目 ${projectPath} 分析完成`);
      
    } catch (error) {
      console.error(`❌ 项目 ${projectPath} 分析失败:`, error);
      // 继续处理下一个项目
      continue;
    }
  }
  
  console.log('\n🏁 批量分析完成！');
}

/**
 * 监控和日志示例
 */
async function monitoringExample() {
  console.log('=== 监控和日志示例 ===');
  
  const scheduler = new AgentScheduler();
  
  const config: AnalysisConfig = {
    repoPath: process.cwd(),
    outputPath: process.cwd(),
    depth: 'normal',
    includeTests: true,
    includeDocs: true
  };
  
  console.log('开始监控知识库生成过程...');
  const startTime = Date.now();
  
  try {
    const result = await scheduler.executeKnowledgeGeneration(config);
    const totalTime = Date.now() - startTime;
    
    // 详细统计信息
    console.log('\n📊 执行统计:');
    console.log(`总执行时间: ${totalTime}ms`);
    console.log(`任务数量: ${result.results.length}`);
    console.log(`成功任务: ${result.metadata.successfulTasks}`);
    console.log(`平均任务时间: ${result.metadata.averageExecutionTime.toFixed(0)}ms`);
    
    // Agent性能分析
    console.log('\n🔍 Agent 性能分析:');
    result.results
      .sort((a, b) => b.executionTime - a.executionTime)
      .forEach(agentResult => {
        console.log(`  ${agentResult.agentName}: ${agentResult.executionTime}ms (${(agentResult.confidence * 100).toFixed(1)}%)`);
      });
    
    // 质量分析
    const highConfidenceResults = result.results.filter(r => r.confidence > 0.8);
    const lowConfidenceResults = result.results.filter(r => r.confidence < 0.6);
    
    console.log('\n📈 质量分析:');
    console.log(`高置信度结果: ${highConfidenceResults.length}/${result.results.length}`);
    console.log(`低置信度结果: ${lowConfidenceResults.length}/${result.results.length}`);
    
    if (lowConfidenceResults.length > 0) {
      console.log('⚠️ 低置信度Agent:');
      lowConfidenceResults.forEach(r => {
        console.log(`  - ${r.agentName}: ${(r.confidence * 100).toFixed(1)}%`);
      });
    }
    
  } catch (error) {
    console.error('❌ 监控过程中发生错误:', error);
  }
}

/**
 * 主函数 - 运行示例
 */
async function main() {
  console.log('🤖 RepoMind 单仓库知识库AI Agent系统');
  console.log('版本: 1.0.0\n');
  
  // 根据命令行参数选择示例
  const example = process.argv[2] || 'basic';
  
  switch (example) {
    case 'basic':
      await basicExample();
      break;
    case 'advanced':
      await advancedExample();
      break;
    case 'custom':
      await customProjectExample();
      break;
    case 'batch':
      await batchAnalysisExample();
      break;
    case 'monitor':
      await monitoringExample();
      break;
    default:
      console.log('可用的示例:');
      console.log('  basic    - 基础使用示例');
      console.log('  advanced - 高级配置示例');
      console.log('  custom   - 自定义项目分析');
      console.log('  batch    - 批量分析项目');
      console.log('  monitor  - 监控和日志示例');
      console.log('\n使用方法: npm run example <示例名称>');
  }
}

// 如果直接运行此文件，执行main函数
if (require.main === module) {
  main().catch(console.error);
}

export {
  basicExample,
  advancedExample,
  customProjectExample,
  batchAnalysisExample,
  monitoringExample
};