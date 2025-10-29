import fs from 'fs';
import path from 'path';

const EXT = '.js';
const ROOT = './'; // adjust if your main code is in a subfolder

function convertFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace require() with import
    content = content.replace(
        /const (\w+) = require\(['"](.+)['"]\);?/g,
        (match, varName, importPath) => {
            const ext = importPath.startsWith('.') ? '.js' : '';
            return `import ${varName} from '${importPath}${ext}';`;
        }
    );

    // Replace module.exports = ... with export default
    content = content.replace(/module\.exports\s*=\s*(\w+);?/g, 'export default $1;');

    // Replace module.exports.<name> = <var> with named export
    content = content.replace(/module\.exports\.(\w+)\s*=\s*(\w+);?/g, 'export const $1 = $2;');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Converted:', filePath);
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkDir(fullPath);
        } else if (fullPath.endsWith(EXT)) {
            convertFile(fullPath);
        }
    });
}

walkDir(ROOT);
