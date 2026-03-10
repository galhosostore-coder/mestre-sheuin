const fs = require('fs');

const manifesto = fs.readFileSync('plans/o_manifesto_do_sabio.md', 'utf8');

// Insert the specific link in Estágio 4
const modifiedManifesto = manifesto.replace(
  '* **Ação:** Como quem entrega um pergaminho precioso, entregue o segredo. Fale sobre a solução como um presente, uma bênção e uma oportunidade de restaurar a harmonia da vida da pessoa.',
  '* **Ação:** Como quem entrega um pergaminho precioso, entregue o segredo. Fale sobre a solução como um presente, uma bênção e uma oportunidade de restaurar a harmonia da vida da pessoa. Quando chegar no Estágio 4 e for apresentar o caminho/frasco, entregue este link com sutileza: https://exemplo.com/encapsulado_secreto'
);

// Escape backticks and ${}
const escapedManifesto = modifiedManifesto.replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

const tsFile = fs.readFileSync('src/services/llm.service.ts', 'utf8');

const regex = /const SYSTEM_PROMPT = `[\s\S]*?`;/;
const newPromptCode = `const SYSTEM_PROMPT_MESTRE = \`\n${escapedManifesto}\`;`;

let newTsFile = tsFile.replace(regex, newPromptCode);

// update systemInstruction
newTsFile = newTsFile.replace(/systemInstruction: SYSTEM_PROMPT,/, 'systemInstruction: SYSTEM_PROMPT_MESTRE,');

fs.writeFileSync('src/services/llm.service.ts', newTsFile);
console.log('llm.service.ts patched successfully.');
