import fs from 'node:fs/promises';import ts from 'typescript';
await fs.mkdir('functions/shared',{recursive:true});
for(const model of ['pricingModel','timeModel','financialModel','permissions','accountingModel','workOrderModel','dispatchModel']){
 const source=await fs.readFile(`src/company/${model}.ts`,'utf8');
 const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replaceAll('./pricingModel.ts','./pricingModel.js').replaceAll('./timeModel.ts','./timeModel.js');
 const target=`functions/shared/${model}.js`;
 let previous;try{previous=await fs.readFile(target,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
 // Rewriting identical modules unnecessarily restarts watched Functions services.
 if(previous!==output)await fs.writeFile(target,output);
}
