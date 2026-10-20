import type {Page} from '@playwright/test';
/** Browser contract fixture only. Real HTTP/MySQL is verified by the live integration suite. */
export async function installHealthFixture(page:Page) {
 const records:{id:string;amountMl:number;recordedAt:string;businessDate:string;source:'manual'}[]=[];
 const availability={nutrition:false,training:false,points:false,rewards:false,companion:false,activities:false};
 const profile={version:1,targetWeightKg:60,waterTargetMl:2000,calorieTargetKcal:1800,goalType:'balanced'};
 await page.route('**/api/v1/**',async route=>{
  const req=route.request(),url=new URL(req.url()),p=url.pathname;
  let data:unknown;
  if(p==='/api/v1/auth/csrf') data={csrfToken:'test-csrf'};
  else if(p==='/api/v1/me/notifications') data={items:[],nextCursor:null};
  else if(p==='/api/v1/me/health-profile') data=profile;
  else if(p==='/api/v1/me/water-records' && req.method()==='POST') {
   const body=req.postDataJSON();const at=body.recordedAt??await page.evaluate(()=>new Date().toISOString());
   const record={id:crypto.randomUUID(),amountMl:body.amountMl,recordedAt:at,businessDate:new Date(Date.parse(at)+8*3600000).toISOString().slice(0,10),source:'manual' as const};records.push(record);
   await route.fulfill({status:201,json:{data:{record,awards:[],rewardsAvailable:false}}});return;
  } else if(p==='/api/v1/me/water-records') data={items:records.filter(x=>x.businessDate===url.searchParams.get('date')),nextCursor:null};
  else if(p==='/api/v1/me/weight-records') data={items:[],nextCursor:null};
  else if(p==='/api/v1/me/dashboard') {
   const date=url.searchParams.get('date')!,total=records.filter(x=>x.businessDate===date).reduce((n,x)=>n+x.amountMl,0);
   data={date,isDemo:false,availability,water:{totalMl:total,targetMl:2000,progress:total/2000},weight:{latestKg:null,targetKg:60,previousKg:null,changeKg:null,bmi:null},energy:{intakeKcal:null,exerciseKcal:null,baseTargetKcal:1800,effectiveTargetKcal:null,remainingKcal:null,exceededKcal:null},nutrients:Object.fromEntries(['carbs','protein','fat'].map(k=>[k,{consumedG:null,targetG:null,complete:false}])),week:[],latestMeal:null,recommendedWorkout:null,pointsBalance:null,dailyTasks:[],generatedAt:new Date().toISOString()};
  } else if(p==='/api/v1/me/health/overview') {
   const range=Number(url.searchParams.get('range')??7),end=url.searchParams.get('endDate')!;
   const series=Array.from({length:range},(_,i)=>({date:new Date(Date.parse(end)-(range-1-i)*86400000).toISOString().slice(0,10),intakeKcal:null,exerciseKcal:null,waterMl:0,weightKg:null,mood:null,completedWorkouts:null,hasMealRecord:false,hasWaterRecord:false}));
   data={range,startDate:series[0].date,endDate:end,generatedAt:new Date().toISOString(),availability,summary:{avgIntakeKcal:null,avgWaterMl:null,completedWorkouts:null,totalExerciseKcal:null,latestWeightKg:null,moodRecordedDays:null,pointsBalance:null,activeBookings:null},series,coverage:{mealDays:null,waterDays:0,weightDays:0,moodDays:null,rangeDays:range}};
  } else {await route.fallback();return;}
  await route.fulfill({json:{data}});
 });
}
