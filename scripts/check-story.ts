// 剧情体检：字数、断链、禁用词。运行：npm run check:story
import { lintStory } from './story-lint';

const r = lintStory();
for (const n of r.report) {
  console.log(`${n.cjk >= 800 ? '✓' : '✗'} ${n.id.padEnd(16)} ${String(n.cjk).padStart(5)} 字  ${n.title}`);
}
if (r.errors.length) {
  for (const e of r.errors) console.error('✗ ' + e);
  console.error(`\n剧情检查未通过：${r.errors.length} 个问题。`);
  process.exit(1);
}
console.log(`\n剧情检查通过：${r.nodes} 个节点，${r.sides} 个支线入口。`);
