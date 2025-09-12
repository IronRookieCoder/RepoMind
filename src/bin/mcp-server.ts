#!/usr/bin/env node

/**
 * MCP服务器CLI入口
 * 用于启动RepoMind MCP服务器
 */

import { MCPServer } from '../mcp/MCPServer';

async function main() {
  try {
    const server = new MCPServer({
      name: 'repomind-mcp-server',
      version: '1.0.0',
      description: 'RepoMind MCP Server - 单仓库知识库查询服务',
      capabilities: {
        tools: true,
        resources: false,
      },
      maxConcurrentRequests: 5,
      timeout: 30000,
    });

    console.error('[MCP Server] 正在启动 RepoMind MCP 服务器...');
    await server.start();
    console.error('[MCP Server] 服务器已启动，等待连接...');
  } catch (error) {
    console.error('[MCP Server] 启动失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('[MCP Server] 未捕获异常:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[MCP Server] 未处理的Promise拒绝:', reason);
  process.exit(1);
});

main().catch((error) => {
  console.error('[MCP Server] 主函数执行失败:', error);
  process.exit(1);
});