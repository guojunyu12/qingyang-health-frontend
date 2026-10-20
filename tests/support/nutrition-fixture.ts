import type {Page} from '@playwright/test';
import {installHealthFixture} from './health-fixture';
export async function installNutritionPage(page:Page,available=true){
 await installHealthFixture(page);
 const fixture=await installNutritionFixture(page,available);
 await page.route('**/api/v1/me',route=>route.fulfill({json:{data:{id:'nutrition-test',nickname:'测试用户',email:'t***@example.com',joinedAt:'2026-10-19T00:00:00Z',timezone:'Asia/Shanghai'}}}));
 return fixture;
}
/** UI contract fixture only; never registered in the application or real API. */
export async function installNutritionFixture(page:Page,available=true){
 const meals:any[]=[];
 const capabilities={mode:'integrated',upload:true,recognition:false,poi:false,poiFavorites:false,points:available,dashboard:true};
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  let data:unknown,status=200;
  if(p==='/api/v1/nutrition/capabilities')data=capabilities;
  else if(p==='/api/v1/foods')data={items:[],nextCursor:null};
  else if(p==='/api/v1/me/restaurant-favorites')data={items:[],nextCursor:null};
  else if(p==='/api/v1/restaurants/nearby')data={items:[],nextCursor:null};
  else if(p==='/api/v1/me/meals'&&req.method()==='GET')data={items:meals.filter(m=>m.businessDate===url.searchParams.get('date')),nextCursor:null};
  else if(p==='/api/v1/me/meals'&&req.method()==='POST'){
   const body=req.postDataJSON(),at=body.recordedAt??new Date().toISOString();
   const meal={...body,id:crypto.randomUUID(),businessDate:new Date(Date.parse(at)+8*3600000).toISOString().slice(0,10),recordedAt:at,version:1,photoAssetId:null,photoUrl:null,createdAt:at,updatedAt:at,items:body.items.map((x:any)=>({...x,id:crypto.randomUUID(),confidence:null})),totals:{caloriesKcal:body.items.reduce((n:number,x:any)=>n+x.caloriesKcal,0),carbsG:null,proteinG:null,fatG:null}};
   meals.push(meal);data={meal,awards:[]};status=201;
  }else {await route.fallback();return;}
  await route.fulfill({status,json:{data}});
 });
 return {meals,capabilities};
}
