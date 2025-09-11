#!/usr/bin/env node
/**
 * CLI功能测试脚本
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testCLI() {
  console.log('🧪 测试RepoMind CLI功能...\n');

  try {
    // 1. 测试版本命令
    console.log('1️⃣ 测试版本显示...');
    const version = execSync('npx ts-node src/bin/cli.ts --version', { encoding: 'utf-8' });
    console.log(`版本: ${version.trim()}`);
    console.log('✅ 版本命令测试通过\n');

    // 2. 测试帮助命令
    console.log('2️⃣ 测试帮助信息...');
    const help = execSync('npx ts-node src/bin/cli.ts --help', { encoding: 'utf-8' });
    if (help.includes('RepoMind')) {
      console.log('✅ 帮助命令测试通过\n');
    } else {
      throw new Error('帮助信息不正确');
    }

    // 3. 测试info命令
    console.log('3️⃣ 测试info命令...');
    const info = execSync('npx ts-node src/bin/cli.ts info', { encoding: 'utf-8' });
    if (info.includes('项目信息')) {
      console.log('✅ info命令测试通过\n');
    } else {
      throw new Error('info命令输出不正确');
    }

    // 4. 测试generate命令帮助
    console.log('4️⃣ 测试generate命令帮助...');
    const genHelp = execSync('npx ts-node src/bin/cli.ts generate --help', { encoding: 'utf-8' });
    if (genHelp.includes('生成知识库')) {
      console.log('✅ generate命令帮助测试通过\n');
    } else {
      throw new Error('generate命令帮助不正确');
    }

    // 5. 测试validate命令（在没有知识库的情况下）
    console.log('5️⃣ 测试validate命令...');
    try {
      execSync('npx ts-node src/bin/cli.ts validate', { encoding: 'utf-8' });
    } catch (error) {
      // 预期会失败，因为没有知识库
      if (error.stdout.includes('未找到知识库')) {
        console.log('✅ validate命令测试通过（正确检测到无知识库）\n');
      } else {
        throw new Error('validate命令错误处理不正确');
      }
    }

    // 6. 测试clean命令
    console.log('6️⃣ 测试clean命令...');
    const clean = execSync('npx ts-node src/bin/cli.ts clean', { encoding: 'utf-8' });
    if (clean.includes('没有找到知识库文件')) {
      console.log('✅ clean命令测试通过\n');
    } else {
      throw new Error('clean命令输出不正确');
    }

    console.log('🎉 所有CLI功能测试通过！');
    return true;

  } catch (error) {
    console.error('❌ CLI测试失败:', error.message);
    if (error.stdout) {
      console.error('标准输出:', error.stdout);
    }
    if (error.stderr) {
      console.error('错误输出:', error.stderr);
    }
    return false;
  }
}

// 测试构建后的CLI
async function testBuiltCLI() {
  console.log('🔨 测试构建后的CLI...\n');

  if (!fs.existsSync('dist/bin/cli.js')) {
    console.error('❌ 构建文件不存在，请先运行 npm run build');
    return false;
  }

  try {
    // 测试构建后的版本
    const version = execSync('node dist/bin/cli.js --version', { encoding: 'utf-8' });
    console.log(`构建版本: ${version.trim()}`);

    const help = execSync('node dist/bin/cli.js --help', { encoding: 'utf-8' });
    if (help.includes('RepoMind')) {
      console.log('✅ 构建后的CLI测试通过\n');
      return true;
    } else {
      throw new Error('构建后的CLI帮助信息不正确');
    }

  } catch (error) {
    console.error('❌ 构建后CLI测试失败:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 RepoMind CLI测试套件\n');

  // 测试开发版本
  const devTest = await testCLI();
  
  // 测试构建版本
  const builtTest = await testBuiltCLI();

  if (devTest && builtTest) {
    console.log('✅ 所有测试通过，CLI已准备就绪！');
    process.exit(0);
  } else {
    console.error('❌ 部分测试失败，请检查问题');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}