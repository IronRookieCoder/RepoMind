/**
 * MCP服务器实现
 * 基于索引系统构建架构的单仓库知识库查询服务
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { 
  MCPServerConfig, 
  SearchKnowledgeArgs, 
  GetKnowledgeBaseArgs,
  GetDocumentArgs,
  RefreshIndexArgs,
  RefreshResult,
  MCPServerStatus
} from './types';
import { AgentScheduler } from '../agents/scheduler/AgentScheduler';
import { KnowledgeQueryTool } from './KnowledgeQueryTool';

export class MCPServer {
  private server: Server;
  private agentScheduler: AgentScheduler;
  private config: MCPServerConfig;

  constructor(config?: Partial<MCPServerConfig>) {
    this.config = {
      name: 'repomind-mcp-server',
      version: '1.0.0',
      description: '基于Claude Code SDK的单仓库知识库查询MCP服务器',
      capabilities: {
        tools: true,
        resources: false,
      },
      maxConcurrentRequests: 5,
      timeout: 30000,
      ...config
    };

    this.agentScheduler = new AgentScheduler();
    this.server = new Server(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          tools: { listChanged: this.config.capabilities.tools },
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 注册工具列表处理器
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_repo_knowledge',
            description: '搜索单仓库知识库内容，支持按文档类型和格式筛选',
            inputSchema: {
              type: 'object',
              properties: {
                repoPath: {
                  type: 'string',
                  description: '仓库路径'
                },
                query: {
                  type: 'string',
                  description: '搜索查询'
                },
                type: {
                  type: 'string',
                  enum: ['overview', 'systemArchitecture', 'apiReference', 'businessWorkflows', 'all'],
                  description: '文档类型，默认为all'
                },
                format: {
                  type: 'string',
                  enum: ['summary', 'detailed', 'reference'],
                  description: '返回格式，默认为summary'
                }
              },
              required: ['repoPath', 'query']
            }
          },
          {
            name: 'get_knowledge_base',
            description: '获取完整的仓库知识库结构信息',
            inputSchema: {
              type: 'object',
              properties: {
                repoPath: {
                  type: 'string',
                  description: '仓库路径'
                }
              },
              required: ['repoPath']
            }
          },
          {
            name: 'get_document',
            description: '获取特定类型的文档内容',
            inputSchema: {
              type: 'object',
              properties: {
                repoPath: {
                  type: 'string',
                  description: '仓库路径'
                },
                documentType: {
                  type: 'string',
                  enum: ['overview', 'systemArchitecture', 'apiReference', 'businessWorkflows'],
                  description: '文档类型'
                }
              },
              required: ['repoPath', 'documentType']
            }
          },
          {
            name: 'refresh_index',
            description: '刷新知识库索引，重新生成或更新知识库',
            inputSchema: {
              type: 'object',
              properties: {
                repoPath: {
                  type: 'string',
                  description: '仓库路径，如果不指定则刷新所有已知仓库'
                }
              },
              required: []
            }
          },
          {
            name: 'get_server_status',
            description: '获取MCP服务器状态信息',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ]
      };
    });

    // 注册工具调用处理器
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_repo_knowledge':
            return await this.handleSearchKnowledge(args as unknown as SearchKnowledgeArgs);
          
          case 'get_knowledge_base':
            return await this.handleGetKnowledgeBase(args as unknown as GetKnowledgeBaseArgs);
          
          case 'get_document':
            return await this.handleGetDocument(args as unknown as GetDocumentArgs);
          
          case 'refresh_index':
            return await this.handleRefreshIndex(args as unknown as RefreshIndexArgs);
          
          case 'get_server_status':
            return await this.handleGetServerStatus();
          
          default:
            throw new Error(`未知工具: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `执行工具 ${name} 时发生错误: ${error instanceof Error ? error.message : String(error)}`
            }
          ],
          isError: true
        };
      }
    });
  }

  private async handleSearchKnowledge(args: SearchKnowledgeArgs) {
    const { repoPath, query, type = 'all', format = 'summary' } = args;
    
    try {
      // 使用KnowledgeQueryTool进行智能搜索
      const results = await KnowledgeQueryTool.searchKnowledge(repoPath, query, type, 10);
      
      // 根据格式要求处理结果
      const formattedResults = results.map(result => ({
        ...result,
        content: this.formatContent(result.content, query, format)
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              type,
              format,
              resultsCount: formattedResults.length,
              results: formattedResults
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `搜索失败: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetKnowledgeBase(args: GetKnowledgeBaseArgs) {
    const { repoPath } = args;
    
    try {
      const result = await KnowledgeQueryTool.getKnowledgeBase(repoPath);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `获取知识库失败: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetDocument(args: GetDocumentArgs) {
    const { repoPath, documentType } = args;
    
    try {
      const result = await KnowledgeQueryTool.getDocument(repoPath, documentType);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `获取文档失败: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleRefreshIndex(args: RefreshIndexArgs) {
    const { repoPath } = args;
    
    try {
      if (repoPath) {
        // 刷新单个仓库
        const result = await this.agentScheduler.executeKnowledgeGeneration({
          repoPath,
          outputPath: repoPath,
          depth: 'normal',
          includeTests: true,
          includeDocs: true
        });

        const refreshResult: RefreshResult = {
          status: result.status,
          message: `知识库生成${result.status === 'success' ? '成功' : '失败'}`,
          reposProcessed: 1,
          ...(result.status === 'error' && { errors: ['知识库生成失败'] })
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(refreshResult, null, 2)
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: '批量刷新功能暂未实现，请指定具体的仓库路径'
            }
          ]
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `刷新索引失败: ${error instanceof Error ? error.message : String(error)}`
          }
        ],
        isError: true
      };
    }
  }

  private async handleGetServerStatus() {
    const status: MCPServerStatus = {
      activeRepos: 0, // TODO: 实现活跃仓库统计
      lastUpdate: new Date().toISOString(),
      version: this.config.version,
      capabilities: ['search_repo_knowledge', 'get_knowledge_base', 'get_document', 'refresh_index']
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }
      ]
    };
  }


  private formatContent(content: string, query: string, format: string): string {
    const lines = content.split('\n');
    
    switch (format) {
      case 'summary':
        // 返回包含查询关键词的前几行
        const queryLower = query.toLowerCase();
        const relevantLines = lines.filter(line => 
          line.toLowerCase().includes(queryLower)
        ).slice(0, 5);
        return relevantLines.join('\n');
      
      case 'reference':
        // 返回包含查询关键词的行号和内容
        const references: string[] = [];
        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            references.push(`${index + 1}: ${line}`);
          }
        });
        return references.slice(0, 10).join('\n');
      
      case 'detailed':
      default:
        return content;
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}