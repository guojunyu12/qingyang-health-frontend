import {test,expect,type Page} from '@playwright/test';
import {installNutritionPage} from '../support/nutrition-fixture';
async function openEditor(page:Page){
 await page.goto('/nutrition');await page.getByRole('button',{name:'手动记餐',exact:true}).click();
 await page.getByLabel('食物名称1',{exact:true}).fill('真实接口测试餐');
 await page.getByLabel('份量1',{exact:true}).fill('100');
 await page.getByLabel('热量1',{exact:true}).fill('130');
}
test('missing dependencies show no demo meals and disable save entry',async({page})=>{
 const {meals}=await installNutritionPage(page,false);await page.goto('/nutrition');
 await expect(page.getByRole('button',{name:'手动记餐',exact:true})).toBeDisabled();
 await expect(page.getByText('记餐奖励服务尚未接入',{exact:false})).toBeVisible();
 await expect(page.getByText('从这一餐，开始好好照顾自己')).toBeVisible();
 await expect(page.getByText('演示商家',{exact:false})).toHaveCount(0);expect(meals).toHaveLength(0);
});
test('meal 4xx rejection rotates key, lost response preserves key',async({page})=>{
 await installNutritionPage(page);const keys:string[]=[];let mode:'reject'|'network'='reject';
 await page.route('**/api/v1/me/meals',async route=>{
  if(route.request().method()!=='POST'){await route.fallback();return;}
  keys.push(route.request().headers()['idempotency-key']);
  if(mode==='reject')await route.fulfill({status:422,json:{error:{code:'INVALID_INPUT',message:'测试校验拒绝'}}});
  else await route.abort('failed');
 });
 await openEditor(page);await page.getByRole('button',{name:'确认记录',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('测试校验拒绝');
 mode='network';await page.getByRole('button',{name:'确认记录',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText(/fetch|network|网络/i);
 await page.getByRole('button',{name:'确认记录',exact:true}).click();
 await expect.poll(()=>keys.length).toBe(3);expect(keys[1]).not.toBe(keys[0]);expect(keys[2]).toBe(keys[1]);
});
test('cancelled manual meal never sends create; both responsive widths fit',async({page})=>{
 const {meals}=await installNutritionPage(page);await openEditor(page);
 await page.keyboard.press('Escape');expect(meals).toHaveLength(0);
 for(const width of [360,1440]){
  await page.setViewportSize({width,height:950});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});
