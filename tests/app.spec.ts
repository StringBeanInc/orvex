import {test,expect} from '@playwright/test';
test('work orders persist, filters work, and all pages are usable', async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/local');
 await expect(page.getByRole('heading',{name:'Operations overview'})).toBeVisible();
 await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
 await expect(page.getByRole('button',{name:'Expand sidebar'})).toBeVisible();
 await page.getByRole('button',{name:'Expand sidebar'}).click();
 await page.getByRole('button',{name:'New work order',exact:true}).click();
 await page.getByLabel('Work Order',{exact:true}).fill('Test preventive maintenance');
 await page.getByLabel('Description',{exact:true}).fill('Inspect pump and verify operation.');
 await expect(page.getByLabel('Assign technician')).toHaveCount(0);
 await page.getByLabel('Priority',{exact:true}).selectOption('Urgent');
 await page.getByRole('button',{name:'Create work order',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Work order created');
 await page.reload();
 await page.getByRole('button',{name:'Work Orders',exact:true}).click();
 await page.getByRole('textbox',{name:'Search work orders'}).fill('Test preventive');
 await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Edit WO-1049'}).click();
 await page.getByLabel('Status',{exact:true}).selectOption('Completed');
 await page.getByRole('button',{name:'Save changes'}).click();
 await page.getByLabel('Filter status').selectOption('Open');
 await expect(page.getByText('No work orders found')).toBeVisible();
 await page.getByLabel('Filter status').selectOption('Completed');
 await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.reload();await page.getByRole('button',{name:'Work Orders',exact:true}).click();
 await page.getByRole('textbox',{name:'Search work orders'}).fill('Test preventive');
 await expect(page.locator('tbody tr')).toContainText('Completed');
 for(const name of ['Customers','Properties','Technicians','Scheduling','Reports','Settings']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('heading',{name,exact:true,level:1})).toBeVisible()}
 await page.getByLabel('Your name').fill('Jordan Lee');await page.getByRole('button',{name:'Save settings'}).click();await page.reload();await expect(page.getByRole('button',{name:'Open profile settings'})).toContainText('Jordan Lee');
 await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Add customer'}).click();
 await page.getByLabel('Name',{exact:true}).fill('Test Customer');await page.getByLabel('Contact person').fill('Taylor Reed');await page.getByLabel('Email',{exact:true}).fill('test@example.com');await page.getByLabel('Phone').fill('312-555-0199');await page.getByRole('button',{name:'Add record'}).click();await expect(page.getByRole('heading',{name:'Test Customer'})).toBeVisible();
 await page.getByRole('button',{name:'Reports',exact:true}).click();const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export report'}).click();expect((await downloadPromise).suggestedFilename()).toMatch(/orvex-work-orders/);
 expect(errors).toEqual([]);
});
test('mobile layout and keyboard dialog',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/local');
 await expect(page.getByRole('button',{name:'Expand sidebar'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('button',{name:'New work order',exact:true}).click();
 await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.screenshot({path:'tests/mobile-preview.png',fullPage:true});
});
test('dashboard preview',async({page})=>{await page.setViewportSize({width:1440,height:1050});await page.goto('/local');await page.screenshot({path:'tests/dashboard-preview.png',fullPage:true});});

test('customer address persists after refreshing',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Add customer'}).click();
 await page.getByLabel('Name',{exact:true}).fill('Address Test Customer');await page.getByLabel('Contact person').fill('Jamie Lee');await page.getByLabel('Email',{exact:true}).fill('jamie@example.com');await page.getByLabel('Phone').fill('312-555-0123');
 await page.getByLabel('Street address',{exact:true}).fill('123 Main Street');await page.getByLabel('Apartment, suite, etc.').fill('Suite 200');await page.getByLabel('City',{exact:true}).fill('Chicago');await page.getByLabel('State / province').fill('IL');await page.getByLabel('ZIP / postal code').fill('60601');await page.getByLabel('Country',{exact:true}).fill('United States');
 await page.getByRole('button',{name:'Add record'}).click();await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();
 const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Address Test Customer'})});await expect(card).toContainText('123 Main Street, Suite 200, Chicago IL 60601, United States');
});

test('sidebar fits shorter windows in both states',async({page})=>{
 for(const height of [759,650,600,500]){
  await page.setViewportSize({width:1045,height});await page.goto('/local');
  for(const collapsed of [false,true]){
   const bounds=await page.locator('.sidebar').evaluate(el=>({bottom:el.getBoundingClientRect().bottom,height:window.innerHeight,nav:el.querySelector('nav')!.scrollHeight,navVisible:el.querySelector('nav')!.clientHeight,profileBottom:el.querySelector('.profile')!.getBoundingClientRect().bottom}));
   expect(bounds.bottom).toBeLessThanOrEqual(height);expect(bounds.profileBottom).toBeLessThanOrEqual(height);
   if(height>=600)expect(bounds.nav).toBeLessThanOrEqual(bounds.navVisible+1);
   await expect(page.getByRole('button',{name:'Open profile settings'})).toBeInViewport();
   if(!collapsed)await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();
  }
 }
});

test('customer property counts open only linked properties',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Customers',exact:true}).click();
 await page.getByRole('button',{name:'View properties for Northstar Living',exact:true}).click();
 await expect(page.locator('.directory-card')).toHaveCount(2);
 await expect(page.getByRole('heading',{name:'Parkside Residences',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'The Northstar Lofts',exact:true})).toBeVisible();
 await page.getByLabel('Search properties').fill('Meridian');await expect(page.getByText('No matching records.',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Show all properties'}).click();await expect(page.locator('.directory-card')).toHaveCount(5);
 await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'View properties for Meridian Partners',exact:true}).click();await expect(page.locator('.directory-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Properties',exact:true}).click();await expect(page.locator('.directory-card')).toHaveCount(5);
});

test('customer deletion requires confirmation and preserves linked records',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Customers',exact:true}).click();
 await page.getByRole('button',{name:'Add customer',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('Delete Test');await page.getByLabel('Contact person').fill('Taylor');await page.getByLabel('Email',{exact:true}).fill('taylor@example.com');await page.getByLabel('Phone').fill('555-0100');await page.getByRole('button',{name:'Add record'}).click();
 await page.getByRole('button',{name:'Delete customer Delete Test',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('restored for 30 days');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Delete Test',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Delete customer Delete Test',exact:true}).click();await page.getByRole('button',{name:'Delete customer',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();await expect(page.getByRole('heading',{name:'Delete Test',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Delete customer Northstar Living',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Cannot delete');await expect(page.getByRole('button',{name:'Delete customer',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'View properties',exact:true}).click();await expect(page.locator('.directory-card')).toHaveCount(2);
});

test('properties are nested under the expandable Customers menu',async({page})=>{
 await page.goto('/local');await expect(page.getByRole('button',{name:'Properties',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Expand customer submenu'}).click();await expect(page.getByRole('button',{name:'Properties',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Properties',exact:true}).click();await expect(page.getByRole('heading',{name:'Properties',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Collapse customer submenu'}).click();await expect(page.getByRole('button',{name:'Properties',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Customers',exact:true}).click();await expect(page.getByRole('button',{name:'Properties',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await expect(page.getByRole('heading',{name:'Properties',exact:true})).toBeVisible();
});

test('work order submenu filters by status and resets to all',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Expand work order submenu'}).click();
 for(const [status,count] of [['Open',5],['In progress',3],['Completed',4]] as const){
 await page.getByRole('navigation').getByRole('button',{name:status,exact:true}).click();await expect(page.getByLabel('Filter status')).toHaveValue(status);await expect(page.locator('tbody tr')).toHaveCount(count);
 }
 await page.getByRole('button',{name:'All work orders',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(12);
 await page.getByRole('button',{name:'Collapse work order submenu'}).click();await expect(page.getByRole('button',{name:'All work orders',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.getByRole('button',{name:'Collapse sidebar',exact:true}).click();await page.getByRole('navigation').getByRole('button',{name:'Completed',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(4);
});

test('work order typing keeps focus and dialog keyboard controls work',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'New work order',exact:true}).click();
 const title=page.getByLabel('Work Order',{exact:true});await title.click();await title.pressSequentially('Repair lobby lights',{delay:30});await expect(title).toHaveValue('Repair lobby lights');await expect(title).toBeFocused();
 const description=page.getByLabel('Description',{exact:true});await description.click();await description.pressSequentially('Replace the damaged fixture.',{delay:20});await expect(description).toHaveValue('Replace the damaged fixture.');await expect(description).toBeFocused();
 await page.getByRole('button',{name:'Create work order',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('button',{name:'Close dialog'})).toBeFocused();await page.keyboard.press('Shift+Tab');await expect(page.getByRole('button',{name:'Create work order',exact:true})).toBeFocused();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.getByRole('button',{name:'Edit WO-1048'}).click();await title.click();await title.press('End');await title.pressSequentially(' - inspected',{delay:20});await expect(title).toHaveValue('Replace rooftop HVAC filter - inspected');await expect(title).toBeFocused();
 await page.getByRole('button',{name:'Save changes'}).click();await page.reload();await expect(page.locator('table').getByText('Replace rooftop HVAC filter - inspected',{exact:true})).toBeVisible();
});

test('property edits persist and preserve linked work orders',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();
 await page.getByRole('button',{name:'Edit property Meridian Tower',exact:true}).click();await page.getByLabel('Property name').fill('Cancelled name');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Meridian Tower',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit property Meridian Tower',exact:true}).click();await page.getByLabel('Property name').fill('Meridian West');await page.getByLabel('Address',{exact:true}).fill('100 West Street');await page.getByLabel('Customer',{exact:true}).selectOption('c2');await page.getByLabel('Property type',{exact:true}).selectOption('Commercial');await page.getByRole('button',{name:'Save changes'}).click();
 await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'View properties for Northstar Living',exact:true}).click();const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Meridian West',exact:true})});await expect(card).toContainText('100 West Street');await expect(card).toContainText('Commercial');await card.getByRole('button',{name:'2 active work orders'}).click();await expect(page.locator('tbody tr')).toHaveCount(3);
});

test('property city state and ZIP persist on creation and editing',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await page.getByRole('button',{name:'Add property',exact:true}).click();
 await page.getByLabel('Name',{exact:true}).fill('Regional Office');await page.getByLabel('Address',{exact:true}).fill('15 Market Street');await page.getByLabel('City',{exact:true}).fill('Boston');await page.getByLabel('State',{exact:true}).fill('MA');await page.getByLabel('ZIP code',{exact:true}).fill('02108');await page.getByRole('button',{name:'Add record'}).click();
 await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await expect(page.getByText('15 Market Street, Boston, MA 02108',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edit property Regional Office',exact:true}).click();await expect(page.getByLabel('ZIP code',{exact:true})).toHaveValue('02108');await page.getByLabel('City',{exact:true}).fill('Cambridge');await page.getByLabel('ZIP code',{exact:true}).fill('02139-1234');await page.getByRole('button',{name:'Save changes'}).click();
 await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await page.getByLabel('Search properties').fill('02139-1234');await expect(page.locator('.directory-card')).toHaveCount(1);await expect(page.getByText('15 Market Street, Cambridge, MA 02139-1234',{exact:true})).toBeVisible();
});

test('property deletion confirms, persists, and protects completed work orders',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await page.getByRole('button',{name:'Add property',exact:true}).click();await page.getByLabel('Name',{exact:true}).fill('Delete Property Test');await page.getByLabel('Address',{exact:true}).fill('123 Test Street');await page.getByRole('button',{name:'Add record'}).click();
 await page.getByRole('button',{name:'Delete property Delete Property Test',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('restored for 30 days');await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('heading',{name:'Delete Property Test',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Delete property Delete Property Test',exact:true}).click();await page.getByRole('button',{name:'Delete property',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await expect(page.getByRole('heading',{name:'Delete Property Test',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Delete property Meridian Tower',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Cannot delete');await expect(page.getByRole('button',{name:'Delete property',exact:true})).toHaveCount(0);await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('orvex-v0.1')!);d.orders=d.orders.map((o:{propertyId:string;status:string})=>o.propertyId==='p1'?{...o,status:'Completed'}:o);localStorage.setItem('orvex-v0.1',JSON.stringify(d))});await page.reload();await page.getByRole('button',{name:'Customers',exact:true}).click();await page.getByRole('button',{name:'Properties',exact:true}).click();await page.getByRole('button',{name:'Delete property Meridian Tower',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('Cannot delete');await expect(page.getByRole('button',{name:'Delete property',exact:true})).toHaveCount(0);
});

test('free text Type saves and can be edited after refresh',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'New work order',exact:true}).click();await page.getByLabel('Work Order',{exact:true}).fill('Type field test');const type=page.getByLabel('Type',{exact:true});await type.click();await type.pressSequentially('Preventive maintenance');await expect(type).toBeFocused();await page.getByRole('button',{name:'Create work order',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.getByRole('button',{name:'Edit WO-1049',exact:true}).click();await expect(type).toHaveValue('Preventive maintenance');await type.fill('Corrective repair');await page.getByRole('button',{name:'Save changes'}).click();await page.getByRole('button',{name:'Edit WO-1049',exact:true}).click();await expect(type).toHaveValue('Corrective repair');
});

test('catalog items persist and are selected on work orders with stable prices',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Line Items',exact:true}).click();
 for(const [category,description,cost] of [['Labor','Repair labor','80'],['Supplies','Hardware','12.50'],['Expenditures','Parking','15']]){
 await page.getByRole('button',{name:category,exact:true}).click();await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByLabel('Category',{exact:true}).locator('option')).toHaveText(['Labor','Supplies','Expenditures']);await page.getByLabel('Category',{exact:true}).selectOption(category);await page.getByLabel('Item description').fill(description);await page.getByLabel('Price (USD)').fill(cost);await page.getByRole('button',{name:'Save catalog item'}).click();}
 await page.reload();await page.getByRole('button',{name:'Line Items',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(3);await page.getByLabel('Filter line item category').selectOption('Supplies');await expect(page.locator('tbody tr')).toHaveCount(1);
 await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.locator('tbody tr').first().locator('.order-link').click();
 for(const [description,quantity] of [['Repair labor','2.5'],['Hardware','3'],['Parking','1']]){await page.getByRole('button',{name:'Add line item'}).click();await expect(page.getByLabel('Item description')).toHaveCount(0);const select=page.getByLabel('Saved line item');const value=await select.locator('option').filter({hasText:description}).getAttribute('value');await select.selectOption(value!);await page.getByLabel('Quantity',{exact:true}).fill(quantity);await page.getByRole('button',{name:'Save line item'}).click();}
 await expect(page.locator('.grand-total')).toContainText('$252.50');
 await page.getByRole('button',{name:'Line Items',exact:true}).click();await page.getByRole('button',{name:'Edit catalog item Repair labor',exact:true}).click();await page.getByLabel('Price (USD)').fill('100');await page.getByRole('button',{name:'Save catalog item'}).click();await page.getByRole('button',{name:'Remove catalog item Parking',exact:true}).click();await page.getByRole('button',{name:'Confirm removal'}).click();
 await page.reload();await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.locator('tbody tr').first().locator('.order-link').click();await expect(page.locator('.grand-total')).toContainText('$252.50');
 await page.getByRole('button',{name:'Edit line item Repair labor',exact:true}).click();await page.getByLabel('Quantity',{exact:true}).fill('3');await page.getByRole('button',{name:'Save line item'}).click();await expect(page.locator('.grand-total')).toContainText('$292.50');
 await page.getByRole('button',{name:'Remove line item Parking',exact:true}).click();await page.getByRole('button',{name:'Confirm removal'}).click();await expect(page.locator('.grand-total')).toContainText('$277.50');
 await page.getByRole('button',{name:'Add line item'}).click();await page.getByLabel('Saved line item').selectOption({label:'Repair labor — $100.00'});await page.getByRole('button',{name:'Save line item'}).click();await expect(page.locator('.grand-total')).toContainText('$377.50');
});
test('old data and manual items remain usable without a catalog',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.getByRole('button',{name:'Edit WO-1048',exact:true}).click();await page.getByRole('button',{name:'Save changes'}).click();await page.evaluate(()=>{const d=JSON.parse(localStorage.getItem('orvex-v0.1')!);delete d.catalog;d.orders[0].lineItems=[{id:'legacy',category:'Labor',description:'Legacy labor',quantity:2,unitCostCents:5000}];localStorage.setItem('orvex-v0.1',JSON.stringify(d))});await page.reload();await page.getByRole('button',{name:'Work Orders',exact:true}).click();await page.locator('tbody tr').first().locator('.order-link').click();await expect(page.locator('.grand-total')).toContainText('$100.00');await page.getByRole('button',{name:'Add line item'}).click();await expect(page.getByText('No saved items available.',{exact:false})).toBeVisible();await page.getByRole('button',{name:'Create items in Line Items'}).click();await expect(page.getByRole('heading',{name:'Saved line items'})).toBeVisible();
});

test('catalog details links and tax preferences persist without receipt upload',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Line Items',exact:true}).click();await page.getByRole('button',{name:'Supplies',exact:true}).click();await page.getByRole('button',{name:'Add item',exact:true}).click();await page.getByLabel('Category',{exact:true}).selectOption('Supplies');await page.getByLabel('Item description').fill('Filter receipt test');await page.getByLabel('Details',{exact:true}).fill('20 x 20 replacement filter');await page.getByLabel('Material link',{exact:true}).fill('https://example.com/filter');await expect(page.getByLabel('Include taxes')).toBeChecked();await expect(page.getByLabel('Upload receipts')).toHaveCount(0);await page.getByRole('button',{name:'Save catalog item'}).click();await page.reload();await page.getByRole('button',{name:'Line Items',exact:true}).click();await expect(page.getByText('20 x 20 replacement filter',{exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Material link'})).toHaveAttribute('href','https://example.com/filter');await page.getByRole('button',{name:'Edit catalog item Filter receipt test'}).click();await expect(page.getByLabel('Include taxes')).toBeChecked();await page.getByLabel('Include taxes').uncheck();await page.getByRole('button',{name:'Save catalog item'}).click();await page.getByRole('button',{name:'Edit catalog item Filter receipt test'}).click();await expect(page.getByLabel('Include taxes')).not.toBeChecked();
});

test('catalog price unit cost and markup persist accurately',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Line Items',exact:true}).click();await page.getByRole('button',{name:'Labor',exact:true}).click();await page.getByRole('button',{name:'Add item',exact:true}).click();await page.getByLabel('Item description').fill('Markup test');await page.getByLabel('Price (USD)').fill('125');await page.getByLabel('Unit Cost (USD)',{exact:true}).fill('100');await expect(page.locator('.markup-summary')).toContainText('25.00%');await expect(page.locator('.markup-summary')).toContainText('$25.00');await page.getByRole('button',{name:'Save catalog item'}).click();await page.reload();await page.getByRole('button',{name:'Line Items',exact:true}).click();await page.getByRole('button',{name:'Edit catalog item Markup test'}).click();await expect(page.getByLabel('Price (USD)')).toHaveValue('125.00');await expect(page.getByLabel('Unit Cost (USD)',{exact:true})).toHaveValue('100.00');await expect(page.locator('.markup-summary')).toContainText('25.00%');await page.getByLabel('Unit Cost (USD)',{exact:true}).fill('0');await expect(page.locator('.markup-summary')).toContainText('N/A');
});

test('material preview appears beside Supplies form and opens safe links',async({page})=>{
 await page.setViewportSize({width:1682,height:759});await page.route('https://example.com/product',route=>route.fulfill({contentType:'text/html',body:'<h1>Sample product</h1>'}));await page.goto('/local');await page.getByRole('button',{name:'Line Items',exact:true}).click();await page.getByRole('button',{name:'Supplies',exact:true}).click();await page.getByRole('button',{name:'Add item',exact:true}).click();await page.getByLabel('Material link',{exact:true}).fill('https://example.com/product');await expect(page.getByRole('link',{name:'Open product',exact:true})).toHaveAttribute('href','https://example.com/product');await page.getByRole('button',{name:'Load product preview'}).click();await expect(page.frameLocator('iframe').getByRole('heading',{name:'Sample product'})).toBeVisible();const form=await page.locator('.catalog-item-form').boundingBox();const preview=await page.locator('.material-preview').boundingBox();expect(preview!.x).toBeGreaterThan(form!.x+form!.width);await page.getByLabel('Category',{exact:true}).selectOption('Labor');await expect(page.locator('.material-preview')).toHaveCount(0);
});

test('categories show lists and Add item opens the selected category',async({page})=>{
 await page.goto('/local');await page.getByRole('button',{name:'Line Items',exact:true}).click();await page.getByRole('button',{name:'Supplies',exact:true}).click();await expect(page.locator('.catalog-item-form')).toHaveCount(0);await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByLabel('Category',{exact:true})).toHaveValue('Supplies');await page.getByLabel('Item description').fill('Saved supply');await page.getByRole('button',{name:'Save catalog item'}).click();await expect(page.locator('tbody tr')).toHaveCount(1);await page.getByRole('button',{name:'Labor',exact:true}).click();await expect(page.locator('tbody tr')).toHaveCount(0);await expect(page.locator('.catalog-item-form')).toHaveCount(0);await page.getByRole('button',{name:'Add item',exact:true}).click();await expect(page.getByLabel('Category',{exact:true})).toHaveValue('Labor');await page.getByRole('button',{name:'Supplies',exact:true}).click();await expect(page.locator('.catalog-item-form')).toHaveCount(0);await expect(page.locator('tbody tr')).toHaveCount(1);
});


test.beforeEach(async({context})=>{await context.addInitScript(()=>sessionStorage.setItem('orvex-explicit-demo','yes'));});
