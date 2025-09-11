#!/usr/bin/env node
/**
 * 发布准备脚本
 * 用于准备npm包发布
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function prepareRelease() {
  console.log('🚀 准备发布 RepoMind npm包...\n');

  try {
    // 1. 检查TypeScript编译
    console.log('1️⃣ 检查TypeScript编译...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });
    console.log('✅ TypeScript检查通过\n');

    // 2. 构建项目
    console.log('2️⃣ 构建项目...');
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true });
    }
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ 项目构建完成\n');

    // 3. 检查必要文件是否存在
    console.log('3️⃣ 检查发布文件...');
    const requiredFiles = [
      'dist/index.js',
      'dist/index.d.ts',
      'dist/bin/cli.js',
      'package.json',
      'README.md'
    ];

    for (const file of requiredFiles) {
      if (!fs.existsSync(file)) {
        throw new Error(`缺少必要文件: ${file}`);
      }
    }
    console.log('✅ 所有必要文件都存在\n');

    // 4. 验证CLI可执行性
    console.log('4️⃣ 验证CLI工具...');
    try {
      const output = execSync('node dist/bin/cli.js --version', { encoding: 'utf-8' });
      console.log(`CLI版本: ${output.trim()}`);
    } catch (error) {
      throw new Error('CLI工具无法正常执行');
    }
    console.log('✅ CLI工具验证通过\n');

    // 5. 检查package.json配置
    console.log('5️⃣ 检查package.json配置...');
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    
    const requiredFields = ['name', 'version', 'description', 'main', 'bin', 'keywords'];
    for (const field of requiredFields) {
      if (!packageJson[field]) {
        throw new Error(`package.json缺少字段: ${field}`);
      }
    }
    
    console.log(`包名: ${packageJson.name}`);
    console.log(`版本: ${packageJson.version}`);
    console.log(`描述: ${packageJson.description}`);
    console.log('✅ package.json配置检查通过\n');

    // 6. 生成发布信息
    console.log('6️⃣ 生成发布信息...');
    const releaseInfo = {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      files: fs.readdirSync('dist'),
      buildTime: new Date().toISOString(),
      nodeVersion: process.version
    };

    fs.writeFileSync('dist/release-info.json', JSON.stringify(releaseInfo, null, 2));
    console.log('✅ 发布信息已生成\n');

    console.log('🎉 发布准备完成！');
    console.log('\n下一步操作:');
    console.log('  npm publish              # 发布到npm');
    console.log('  npm publish --dry-run    # 预览发布内容');
    console.log('  npm pack                 # 生成.tgz包');

  } catch (error) {
    console.error('❌ 发布准备失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  prepareRelease();
}

module.exports = { prepareRelease };