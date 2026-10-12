import {active} from '../security/records';
import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
import {money,lineAmount,type BusinessDocument,type TemplateBlock,type DocumentTemplate} from './model';
import {blockContent} from './content';
const categoryLabel=(s:string)=>s==='Supplies'?'Materials':s==='Expenditures'?'Additional charges':s;
export function createDocumentPdf(d:BusinessDocument,template:DocumentTemplate=d.template){d={...d,items:active(d.items)};
 const pdf=new jsPDF({unit:'mm',format:'letter'});pdf.setProperties({title:`${d.title} ${d.number}`,author:d.company.businessName,subject:d.workOrderTitle});const bottom=260;const ink='#283442';const accent=/^#[0-9a-f]{6}$/i.test(template.accent)?template.accent:'#243c58';
 const blocks=[...template.blocks].sort((a,b)=>a.page-b.page||a.y-b.y||a.x-b.x);let offset=0;let previousTemplatePage=0;
 const occupied:{page:number;x:number;right:number;bottom:number}[]=[];
 const ensure=(page:number)=>{while(pdf.getNumberOfPages()<page+1)pdf.addPage();pdf.setPage(page+1);};
 const newPage=(page:number)=>{ensure(page+1);return {page:page+1,y:16};};
 for(let index=0;index<blocks.length;){const b0=blocks[index];const row=blocks.filter(b=>b.page===b0.page&&b.y===b0.y);index+=row.length;if(b0.page!==previousTemplatePage){offset=0;previousTemplatePage=b0.page;}
  let rowExtra=Number.NEGATIVE_INFINITY;let visible=false;
  for(const b of row){const lines=blockContent(b,d);const isTable=b.kind==='Line Items';const isLogo=b.kind==='Company Logo';if(isTable&&!b.columns.length)continue;if(!isTable&&!(isLogo&&d.company.logo)&&!lines.length)continue;visible=true;
   const missingLogo=b.kind==='Company Information'&&!d.company.logo&&b.x===50&&b.y===14;const x=missingLogo?16:Math.max(12,Math.min(200,b.x));const width=Math.max(20,Math.min(203.9-x,b.width+(missingLogo?34:0)));const size=Math.max(7,Math.min(24,b.fontSize));pdf.setFont('helvetica','normal');pdf.setFontSize(size);const lineHeight=size*.43;let pos={page:b.page,y:Math.max(16,b.y+offset)};
   while(pos.y>=bottom){pos.y-=bottom-16;pos.page++;}
   const measuredTextHeight=lines.reduce((n,line)=>n+(pdf.splitTextToSize(line,width) as string[]).length*lineHeight,0)+(b.heading&&b.kind!=='Grand Total'?lineHeight+3:0);const keepHeight=isTable?Math.max(28,Math.min(b.height,32)):Math.max(Math.min(b.height,24),measuredTextHeight<=40?measuredTextHeight:0);
   // Explicit template pages may already contain a continued table or long scope.
   // Search subsequent pages until the whole small block has an unoccupied slot.
   for(let attempt=0;attempt<10000;attempt++){let nextY=pos.y;for(const reserved of occupied){if(reserved.page===pos.page&&x<reserved.right&&x+width>reserved.x&&nextY<reserved.bottom+3)nextY=reserved.bottom+3;}if(nextY+keepHeight>bottom){pos=newPage(pos.page);continue;}pos.y=nextY;break;}
   ensure(pos.page);let y=pos.y;
   const heading=()=>{if(b.heading&&b.kind!=='Grand Total'){pdf.setFont('helvetica','bold');pdf.setFontSize(Math.max(8,size));pdf.setTextColor(accent);const hs=pdf.splitTextToSize(b.heading.toUpperCase(),width) as string[];for(const h of hs){pdf.text(h,x+(b.align==='right'?width:b.align==='center'?width/2:0),y+3,{align:b.align});y+=lineHeight;}y+=3;}};
   if(isLogo){const props=pdf.getImageProperties(d.company.logo);const h=Math.min(b.height,width*props.height/props.width);const w=h*props.width/props.height;pdf.addImage(d.company.logo,props.fileType,x+(width-w)*(b.align==='right'?1:b.align==='center'?.5:0),y,w,h);y+=h;
   }else if(isTable){heading();const cols=b.columns.length?b.columns:['Description','Amount'];const values=d.items.map(i=>cols.map(c=>c==='Category'?categoryLabel(i.category):c==='Description'?[i.description,i.details,i.skuCode?`SKU: ${i.skuCode}`:''].filter(Boolean).join('\n'):c==='Quantity'?String(i.quantity):c==='Rate'?money(i.unitCostCents):money(lineAmount(i))));
    const numeric=Object.fromEntries(cols.map((c,i)=>[i,{halign:['Quantity','Rate','Amount'].includes(c)?'right' as const:'left' as const}]));
    autoTable(pdf,{startY:y,margin:{left:x,right:215.9-x-width,top:16,bottom:19.4},head:[cols],body:values.length?values:[cols.map((_,i)=>i===0?'No priced line items':'')],theme:'grid',rowPageBreak:'avoid',styles:{font:'helvetica',fontSize:size,cellPadding:2.2,textColor:ink,lineColor:'#dce1e7',lineWidth:.15,overflow:'linebreak'},headStyles:{fillColor:accent,textColor:'#ffffff',fontStyle:'bold'},columnStyles:numeric});
    let end=(pdf as jsPDF&{lastAutoTable:{finalY:number}}).lastAutoTable.finalY;const endPage=pdf.getCurrentPageInfo().pageNumber-1;
    if(endPage===pos.page)end=Math.max(end,pos.y+b.height);for(let page=pos.page;page<=endPage;page++)occupied.push({page,x,right:x+width,bottom:page===endPage?end:bottom});
    rowExtra=Math.max(rowExtra,(endPage-b.page)*(bottom-16)+end-b.y-offset-b.height);continue;
   }else{heading();pdf.setTextColor(ink);pdf.setFontSize(size);const bold=b.kind==='Grand Total'||b.kind==='Document Title and Number'||b.kind==='Company Information';const wrapped=lines.flatMap(line=>pdf.splitTextToSize(line,width) as string[]);
    for(let li=0;li<wrapped.length;li++){if(y+lineHeight>bottom){occupied.push({page:pos.page,x,right:x+width,bottom:y});pos=newPage(pos.page);y=pos.y;ensure(pos.page);if(b.heading){heading();}}
     pdf.setFont('helvetica',bold&&li===0?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(ink);pdf.text(wrapped[li],x+(b.align==='right'?width:b.align==='center'?width/2:0),y+lineHeight*.8,{align:b.align});y+=lineHeight;}
   }
   const finalY=Math.max(y,pos.y+b.height);occupied.push({page:pos.page,x,right:x+width,bottom:finalY});rowExtra=Math.max(rowExtra,(pos.page-b.page)*(bottom-16)+finalY-b.y-offset-b.height);
  }
  if(visible)offset+=Math.max(0,rowExtra);else{const next=blocks[index];offset-=next&&next.page===b0.page?next.y-b0.y:Math.max(...row.map(b=>b.height));}
 }
 const pages=pdf.getNumberOfPages();for(let p=1;p<=pages;p++){pdf.setPage(p);pdf.setDrawColor('#dce1e7');pdf.line(16,267,200,267);pdf.setTextColor('#6b7785');pdf.setFont('helvetica','normal');pdf.setFontSize(8);const footer=[d.company.businessName,d.company.footer].filter(Boolean).join(' | ');pdf.text(pdf.splitTextToSize(footer,145).slice(0,2),16,272);pdf.text(`${d.number} | ${p} / ${pages}`,200,272,{align:'right'});}
 return pdf;
}
export async function pdfBlob(d:BusinessDocument,template?:DocumentTemplate){return createDocumentPdf(d,template).output('blob');}
