import { mkdir, cp, readFile } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
for (const file of ['index.html', 'favicon.svg', 'src', 'data']) await cp(file, `dist/${file}`, {recursive:true});
await readFile('dist/data/dissertation.json');
console.log('Готово: dist/ — автономное статическое приложение.');
