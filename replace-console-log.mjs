import fs from 'fs';
import path from 'path';

const filesToUpdate = [
  'src/app/page.tsx',
  'src/components/GameCanvas.tsx',
  'src/components/menus/LANLobby.tsx',
  'src/components/menus/MatchmakingScreen.tsx',
  'src/engine/core/Game.ts',
  'src/engine/multiplayer/LANNetworkManager.ts',
  'src/engine/multiplayer/NetworkManager.ts',
  'src/hooks/useLANMultiplayer.ts',
  'src/hooks/useMultiplayer.ts',
  'src/lib/socket/localClient.ts',
  'src/lib/socket/localServer.ts',
  'src/lib/socket/server.ts',
];

let totalReplaced = 0;

for (const file of filesToUpdate) {
  const filepath = path.join(process.cwd(), file);

  if (!fs.existsSync(filepath)) {
    console.log(`⚠️  File not found: ${file}`);
    continue;
  }

  let content = fs.readFileSync(filepath, 'utf8');
  const originalContent = content;

  // Check if Logger is already imported
  const hasLoggerImport = content.includes('from') && content.includes('Logger');

  // Add Logger import at the top if not present
  if (!hasLoggerImport && content.includes('console.log')) {
    // Find the first import statement
    const firstImportMatch = content.match(/^import /m);

    if (firstImportMatch) {
      const loggerImport = file.endsWith('.tsx')
        ? "import { Logger } from '@/lib/logging/Logger';\n"
        : "import { Logger } from '../lib/logging/Logger';\n";

      // Insert before first import
      const insertPos = firstImportMatch.index;
      content = content.slice(0, insertPos) + loggerImport + content.slice(insertPos);
    }
  }

  // Replace console.log with Logger.debug
  const replaced = content.split('console.log').length - 1;
  content = content.replace(/console\.log\(/g, 'Logger.debug(');

  if (content !== originalContent) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`✅ ${file}: Replaced ${replaced} console.log statements`);
    totalReplaced += replaced;
  } else {
    console.log(`ℹ️  ${file}: No changes needed`);
  }
}

console.log(`\n📊 Total console.log statements replaced: ${totalReplaced}`);
