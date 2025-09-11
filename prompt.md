@CLAUDE.md 仔细思考，生成完善后思路 

*************************************


我希望基于Claude Code强大的代码理解能力（可在本地构建后上传到远端仓库），构建仓库知识库，而不是基于RAG技术。
*************************************

仔细检查一遍，确保方案正确且具备可行性。

*************************************
项目是基于claude code SDK（https://docs.anthropic.com/zh-CN/docs/claude-code/sdk/sdk-overview），而不是基于claude api

*************************************
第一阶段按照如下计划进行开发：
1、定义单仓库知识库规范（保持精简）
2、参考规范 @src\standard\single-repo-knowledge-spec.md ，定义好claude code SDK需要的prompt文档（拆分为多个，放置到src/prompts目录）
3、基于claude code SDK和@src/prompts/index.md，设计agent构建方案（放置到docs/目录）
4、根据方案 @docs\agent-construction-plan.md，实现单仓库的知识库AI agent（代码放置在src/目录下）
5、完成cli工具开发，支持单仓库的知识库构建
6、MCP协议集成：支持单仓库的知识库查询

第二阶段按照如下计划进行开发：
1、定义多仓库关联关系检索的规范（保持精简）
2、支持跨仓库智能检索
3、MCP协议集成：支持跨仓库智能检索


第三阶段按照如下计划进行开发：
1、支持API、web服务
2、Git集成
3、CI/CD集成

*************************************
修复ts类型报错

*************************************


*************************************
参考claude code SDK官方文档（https://docs.anthropic.com/zh-CN/docs/claude-code/sdk/sdk-typescript），检查Claude Code TypeScript SDK的相关逻辑。


*************************************
分析器不能做固定的文件模式匹配，而是需要利用claude-code的能力进行动态匹配  

*************************************

使用命令行，运行repomind analyze . 功能测试（先忽略eslint报错）；


agent调用方式已经修改为：基于项目的独立分析，每个Agent负责不同的分析维度，都是基于同一份源代码，如：
  - 概览Agent：分析项目整体特征
  - 架构Agent：分析系统设计模式
  - ...
修改prompts进行适配

*************************************

 @src\utils\sdk-helper.ts 根据官方文档，进行优化：1、启用部分消息流式传输，跟踪思考进度（日志输出）
 


